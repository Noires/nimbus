import type { Connection, Task } from "@prisma/client";
import prisma from "../prisma-client.js";
import { publish } from "../bus.js";
import { recordEvent } from "../events.js";
import { providerFor } from "./registry.js";
import { ProviderError, type RemoteIssue } from "./types.js";

// Sync engine invariants:
// - Pushes to the provider originate ONLY from the taskRoutes PATCH hook
//   (queuePush) and this engine's dirty/conflict passes. Engine-applied
//   inbound changes write via Prisma directly, so they can never re-push.
// - After every push, the provider's fresh updated_at is stored as
//   externalMeta.remoteUpdatedAt; the poll skips issues at or below that
//   watermark (echo prevention; GitHub timestamps are second-granularity).
// - Conflict policy: if both sides changed since the last reconcile, the
//   most recent edit wins whole-record (no field merge).

export interface SyncSummary {
  imported: number;
  updated: number;
  pushed: number;
  skipped: number;
}

const INCLUDE_CHECKLIST = { checklist: { orderBy: { order: "asc" as const } } };

const timers = new Map<string, NodeJS.Timeout>();
const running = new Set<string>();
const backoff = new Map<string, number>();

export async function initSync(): Promise<void> {
  const connections = await prisma.connection.findMany({ where: { enabled: true } });
  for (const conn of connections) {
    schedule(conn.id, 5_000 + Math.random() * 5_000); // stagger boot polls
  }
  if (connections.length) console.log(`🔄 sync engine: ${connections.length} connection(s) scheduled`);
}

function schedule(connId: string, delayMs: number) {
  clearTimeout(timers.get(connId));
  timers.set(connId, setTimeout(() => void runPoll(connId).catch(() => {}), delayMs));
}

export async function reschedule(connId: string): Promise<void> {
  backoff.delete(connId);
  schedule(connId, 1_000);
}

export function unschedule(connId: string): void {
  clearTimeout(timers.get(connId));
  timers.delete(connId);
  backoff.delete(connId);
}

export async function syncNow(connId: string): Promise<SyncSummary> {
  return runPoll(connId);
}

function meta(task: Task): Record<string, unknown> {
  return (task.externalMeta as Record<string, unknown>) ?? {};
}

function isDirty(task: Task): boolean {
  return !task.syncedAt || task.lastActivityAt > task.syncedAt;
}

async function runPoll(connId: string): Promise<SyncSummary> {
  const summary: SyncSummary = { imported: 0, updated: 0, pushed: 0, skipped: 0 };
  if (running.has(connId)) return summary;
  running.add(connId);

  let conn = await prisma.connection.findUnique({ where: { id: connId } });
  try {
    if (!conn || !conn.enabled) return summary;
    const provider = providerFor(conn.provider);
    const startedAt = new Date();
    const firstSync = !conn.lastSyncAt;

    // ---- 1. Inbound: changed issues (since with 60s clock-skew overlap) ----
    const since = conn.lastSyncAt ? new Date(conn.lastSyncAt.getTime() - 60_000) : null;
    const result = await provider.listChanged(conn, since);
    if (!result.notModified) {
      for (const issue of result.issues) {
        if (issue.isPullRequest) continue;
        await reconcileIssue(conn, issue, firstSync, summary);
      }
    }

    // ---- 2. Inbound: project-mode status sweep (field edits don't bump updated_at) ----
    const sweepTasks = await prisma.task.findMany({ where: { connectionId: conn.id } });
    const sweepKeys = sweepTasks.map((t) => t.externalKey).filter((k): k is string => k !== null);
    const statuses = sweepKeys.length > 0 ? await provider.listStatuses(conn, sweepKeys) : null;
    if (statuses) {
      const byKey = new Map(sweepTasks.map((t) => [t.externalKey, t]));
      for (const entry of statuses) {
        const task = byKey.get(entry.key);
        if (!task) continue;
        const knownItemId = meta(task).projectItemId;
        if (task.status === entry.status && knownItemId === entry.projectItemId) continue;
        if (task.status !== entry.status && isDirty(task)) {
          summary.skipped++; // local status edit pending push — don't clobber
          continue;
        }
        await applyRemotePatch(
          task,
          task.status === entry.status ? {} : { status: entry.status },
          { projectItemId: entry.projectItemId },
          summary,
        );
      }
    }

    // ---- 3. Outbound: re-push dirty tasks (recovers edits made during outages) ----
    const connTasks = await prisma.task.findMany({ where: { connectionId: conn.id } });
    for (const task of connTasks.filter(isDirty)) {
      await pushTask(conn, task, { title: true, body: true, state: true, status: true });
      summary.pushed++;
    }

    conn = await prisma.connection.update({
      where: { id: conn.id },
      data: {
        lastSyncAt: startedAt,
        etag: result.etag ?? conn.etag,
        status: "ok",
        statusMessage: null,
      },
    });
    publish(conn.canvasId, { entity: "connection", action: "upsert", data: conn });
    backoff.delete(connId);
    return summary;
  } catch (e) {
    const message =
      e instanceof ProviderError ? `GitHub ${e.status}: ${e.message}` : (e as Error).message;
    if (conn) {
      conn = await prisma.connection.update({
        where: { id: connId },
        data: { status: "error", statusMessage: message.slice(0, 400) },
      });
      publish(conn.canvasId, { entity: "connection", action: "upsert", data: conn });
    }
    backoff.set(connId, Math.min((backoff.get(connId) ?? 1) * 2, 12));
    throw e instanceof Error ? e : new Error(message);
  } finally {
    running.delete(connId);
    if (conn?.enabled) {
      schedule(connId, conn.pollMinutes * 60_000 * (backoff.get(connId) ?? 1));
    }
  }
}

function passesFilters(conn: Connection, issue: RemoteIssue): boolean {
  const config = conn.config as { labels?: string[]; assignee?: string };
  if (config.labels?.length && !config.labels.every((l) => issue.labels.includes(l))) return false;
  if (config.assignee && issue.assignee !== config.assignee) return false;
  return true;
}

function metaOf(issue: RemoteIssue): Record<string, unknown> {
  return {
    number: issue.number,
    nodeId: issue.nodeId,
    labels: issue.labels,
    assignee: issue.assignee,
    state: issue.state,
    remoteUpdatedAt: issue.updatedAt,
  };
}

function repoHue(conn: Connection): string {
  const config = conn.config as { owner: string; repo: string };
  const name = `${config.owner}/${config.repo}`;
  let h = 5381 >>> 0;
  for (let i = 0; i < name.length; i++) h = (((h << 5) + h) ^ name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 70%, 55%)`;
}

async function placeFor(conn: Connection): Promise<Record<string, unknown>> {
  const config = conn.config as {
    placement?: string;
    bubbleId?: string;
    anchorX?: number;
    anchorY?: number;
    owner: string;
    repo: string;
  };
  if (config.placement !== "canvas") return { inbox: true };

  let bubble = config.bubbleId
    ? await prisma.bubble.findUnique({ where: { id: config.bubbleId } })
    : null;
  if (!bubble) {
    bubble = await prisma.bubble.create({
      data: {
        canvasId: conn.canvasId,
        title: `${config.owner}/${config.repo}`,
        pinned: true,
        memberIds: [],
      },
    });
    const newConfig = { ...(conn.config as object), bubbleId: bubble.id };
    await prisma.connection.update({
      where: { id: conn.id },
      data: { config: newConfig },
    });
    // Mutate the in-memory connection too — later imports in the SAME poll
    // must see the bubble, or every issue creates its own.
    (conn as { config: unknown }).config = newConfig;
    publish(conn.canvasId, { entity: "bubble", action: "upsert", data: bubble });
  }
  const n = bubble.memberIds.length;
  const anchorX = config.anchorX ?? 120;
  const anchorY = config.anchorY ?? 120;
  return {
    x: anchorX + (n % 4) * 300,
    y: anchorY + Math.floor(n / 4) * 220,
    _bubbleId: bubble.id,
  };
}

async function reconcileIssue(
  conn: Connection,
  issue: RemoteIssue,
  firstSync: boolean,
  summary: SyncSummary,
) {
  if (!passesFilters(conn, issue)) return;
  const provider = providerFor(conn.provider);
  const task = await prisma.task.findUnique({ where: { externalKey: issue.key } });

  if (!task) {
    // ---- import ----
    if (firstSync && issue.state === "closed") return; // don't flood with history
    const placement = await placeFor(conn);
    const bubbleId = placement._bubbleId as string | undefined;
    delete placement._bubbleId;
    try {
      // One shared timestamp: lastActivityAt must NOT exceed syncedAt, or the
      // fresh import counts as dirty and pass 3 immediately re-pushes it.
      const syncTime = new Date();
      const created = await prisma.task.create({
        data: {
          canvasId: conn.canvasId,
          title: issue.title,
          description: issue.body,
          tags: [],
          color: repoHue(conn),
          done: issue.state === "closed",
          provider: conn.provider,
          connectionId: conn.id,
          externalKey: issue.key,
          externalUrl: issue.url,
          status: provider.deriveStatus(conn, issue),
          externalMeta: metaOf(issue) as never,
          syncedAt: syncTime,
          lastActivityAt: syncTime,
          ...placement,
        },
        include: INCLUDE_CHECKLIST,
      });
      if (bubbleId) {
        const bubble = await prisma.bubble.update({
          where: { id: bubbleId },
          data: { memberIds: { push: created.id } },
        });
        publish(conn.canvasId, { entity: "bubble", action: "upsert", data: bubble });
      }
      void recordEvent({
        taskId: created.id,
        canvasId: conn.canvasId,
        type: "created",
        payload: { title: created.title, externalKey: issue.key },
        actor: "github",
      });
      publish(conn.canvasId, { entity: "task", action: "upsert", data: created });
      summary.imported++;
    } catch (e) {
      // externalKey unique violation: the same repo is connected on another
      // canvas — one repo ↔ one canvas.
      if ((e as { code?: string }).code === "P2002") summary.skipped++;
      else throw e;
    }
    return;
  }

  // ---- echo guard: our own push produced this updated_at ----
  const watermark = meta(task).remoteUpdatedAt as string | undefined;
  if (watermark && issue.updatedAt <= watermark) return;

  // ---- diff remote → local ----
  const patch: Record<string, unknown> = {};
  if (issue.title !== task.title) patch.title = issue.title;
  if (issue.body !== task.description) patch.description = issue.body;
  if ((issue.state === "closed") !== task.done) patch.done = issue.state === "closed";
  const derived = providerFor(conn.provider).deriveStatus(conn, issue);
  if (derived && derived !== task.status) patch.status = derived;
  if (issue.url !== task.externalUrl) patch.externalUrl = issue.url;

  if (Object.keys(patch).length === 0) {
    // Nothing user-visible changed — just refresh the metadata snapshot.
    await prisma.task.update({
      where: { id: task.id },
      data: { externalMeta: { ...meta(task), ...metaOf(issue) } as never },
    });
    return;
  }

  // ---- conflict: both sides edited since the last reconcile ----
  if (isDirty(task)) {
    if (task.lastActivityAt.getTime() > Date.parse(issue.updatedAt)) {
      await pushTask(conn, task, { title: true, body: true, state: true, status: true });
      summary.pushed++;
      return; // local wins → remote overwritten
    }
    // remote wins → fall through and overwrite local
  }
  await applyRemotePatch(task, patch, metaOf(issue), summary);
}

async function applyRemotePatch(
  task: Task,
  patch: Record<string, unknown>,
  metaPatch: Record<string, unknown>,
  summary: SyncSummary,
) {
  const now = new Date();
  const saved = await prisma.task.update({
    where: { id: task.id },
    data: {
      ...patch,
      externalMeta: { ...meta(task), ...metaPatch } as never,
      lastActivityAt: now,
      syncedAt: now, // equal ⇒ not dirty
    },
    include: INCLUDE_CHECKLIST,
  });
  if (Object.keys(patch).length > 0) {
    void recordEvent({
      taskId: task.id,
      canvasId: task.canvasId,
      type: patch.done === true ? "completed" : "updated",
      payload: JSON.parse(JSON.stringify({ fields: patch })),
      actor: "github",
    });
    summary.updated++;
  }
  // No clientId ⇒ every tab (including the one that triggered nothing) applies it.
  publish(task.canvasId, { entity: "task", action: "upsert", data: saved });
}

// ---- outbound ----

interface PushSelection {
  title?: boolean;
  body?: boolean;
  state?: boolean;
  status?: boolean;
}

async function pushTask(conn: Connection, task: Task, which: PushSelection) {
  const provider = providerFor(conn.provider);
  let remoteUpdatedAt: string | undefined;
  let projectItemId: string | undefined;

  const fields: { title?: string; body?: string; state?: "open" | "closed" } = {};
  if (which.title) fields.title = task.title;
  if (which.body) fields.body = task.description;
  if (which.state) fields.state = task.done ? "closed" : "open";
  if (Object.keys(fields).length) {
    const res = await provider.pushFields(conn, task, fields);
    remoteUpdatedAt = res.remoteUpdatedAt ?? remoteUpdatedAt;
  }
  if (which.status && task.status) {
    const res = await provider.setStatus(conn, task, task.status);
    remoteUpdatedAt = res.remoteUpdatedAt ?? remoteUpdatedAt;
    projectItemId = res.projectItemId;
  }

  // Watermark bookkeeping: direct write, no publish, no event.
  await prisma.task.update({
    where: { id: task.id },
    data: {
      syncedAt: new Date(),
      externalMeta: {
        ...meta(task),
        ...(task.done ? { state: "closed" } : { state: "open" }),
        ...(remoteUpdatedAt ? { remoteUpdatedAt } : {}),
        ...(projectItemId ? { projectItemId } : {}),
      } as never,
    },
  });
}

/** Fire-and-forget push from the taskRoutes PATCH hook. */
export function queuePush(taskId: string, fields: Record<string, unknown>): void {
  void (async () => {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { connection: true },
    });
    if (!task?.connection || !task.connection.enabled) return;
    try {
      await pushTask(task.connection, task, {
        title: "title" in fields,
        body: "description" in fields,
        state: "done" in fields,
        status: "status" in fields,
      });
    } catch (e) {
      const message =
        e instanceof ProviderError ? `push failed — GitHub ${e.status}: ${e.message}` : `push failed: ${(e as Error).message}`;
      const conn = await prisma.connection.update({
        where: { id: task.connection.id },
        data: { status: "error", statusMessage: message.slice(0, 400) },
      });
      publish(conn.canvasId, { entity: "connection", action: "upsert", data: conn });
      // The local edit stays dirty (lastActivityAt > syncedAt) and pass 3 of
      // the next successful poll re-pushes it.
    }
  })();
}
