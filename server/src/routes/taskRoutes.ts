import { Router } from "express";
import prisma from "../prisma-client.js";
import { recordEvent, recordEvents } from "../events.js";
import { publish } from "../bus.js";
import { queuePush } from "../integrations/syncEngine.js";
import { providerFor } from "../integrations/registry.js";
import { ProviderError } from "../integrations/types.js";

const router = Router();

const INCLUDE_CHECKLIST = { checklist: { orderBy: { order: "asc" as const } } };

type CanvasSettings = { autoCompleteChecklist?: boolean; autoArchiveDays?: number };

async function canvasSettings(canvasId: string): Promise<CanvasSettings> {
  const canvas = await prisma.canvas.findUnique({ where: { id: canvasId } });
  return (canvas?.settings as CanvasSettings) ?? {};
}

// GET /api/tasks?canvasId=&done=&archived=&page=&pageSize=
router.get("/", async (req, res) => {
  try {
    const canvasId = req.query.canvasId as string | undefined;
    const done =
      req.query.done === "true" ? true : req.query.done === "false" ? false : undefined;
    const includeArchived = req.query.archived === "true";
    const page = parseInt(req.query.page as string) || 0;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 200, 500);

    // Autopilot (c): lazily archive long-done tasks when the canvas opts in.
    if (canvasId) {
      const settings = await canvasSettings(canvasId);
      if (typeof settings.autoArchiveDays === "number" && settings.autoArchiveDays > 0) {
        const cutoff = new Date(Date.now() - settings.autoArchiveDays * 86_400_000);
        const stale = await prisma.task.findMany({
          where: { canvasId, done: true, archivedAt: null, lastActivityAt: { lt: cutoff } },
          select: { id: true },
        });
        if (stale.length) {
          await prisma.task.updateMany({
            where: { id: { in: stale.map((s) => s.id) } },
            data: { archivedAt: new Date() },
          });
          void recordEvents(
            stale.map((s) => ({
              taskId: s.id,
              canvasId,
              type: "updated" as const,
              payload: { fields: { archivedAt: "autopilot" } },
              actor: "autopilot",
            })),
          );
        }
      }
    }

    const where: Record<string, unknown> = {};
    if (canvasId) where.canvasId = canvasId;
    if (done !== undefined) where.done = done;
    if (!includeArchived) where.archivedAt = null;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: INCLUDE_CHECKLIST,
        orderBy: [{ z: "asc" }, { createdAt: "asc" }],
        skip: page * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    res.json({ tasks, total });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/tasks/:id — single task
router.get("/:id", async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: INCLUDE_CHECKLIST,
    });
    if (!task) return res.status(404).json({ error: "Task not found" });
    return res.json(task);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// --- Provider comments proxy (synced tasks only; never stored locally) ---

type SyncedLookup =
  | { error: [number, string]; task?: undefined; connection?: undefined }
  | { error?: undefined; task: NonNullable<Awaited<ReturnType<typeof findSynced>>>; connection: NonNullable<NonNullable<Awaited<ReturnType<typeof findSynced>>>["connection"]> };

function findSynced(id: string) {
  return prisma.task.findUnique({ where: { id }, include: { connection: true } });
}

async function syncedTaskWithConnection(id: string): Promise<SyncedLookup> {
  const task = await findSynced(id);
  if (!task) return { error: [404, "Task not found"] };
  if (!task.connection) return { error: [400, "Task is not synced with an external system"] };
  return { task, connection: task.connection };
}

router.get("/:id/comments", async (req, res) => {
  try {
    const found = await syncedTaskWithConnection(req.params.id);
    if (found.error) return res.status(found.error[0]).json({ error: found.error[1] });
    const comments = await providerFor(found.connection.provider).listComments(found.connection, found.task);
    return res.json({ comments });
  } catch (e) {
    const status = e instanceof ProviderError ? 502 : 500;
    return res.status(status).json({ error: (e as Error).message });
  }
});

router.post("/:id/comments", async (req, res) => {
  try {
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body) return res.status(400).json({ error: "Missing comment body" });
    const found = await syncedTaskWithConnection(req.params.id);
    if (found.error) return res.status(found.error[0]).json({ error: found.error[1] });
    const comment = await providerFor(found.connection.provider).addComment(found.connection, found.task, body);
    return res.status(201).json(comment);
  } catch (e) {
    const status = e instanceof ProviderError ? 502 : 500;
    return res.status(status).json({ error: (e as Error).message });
  }
});

// GET /api/tasks/:id/events — per-task history
router.get("/:id/events", async (req, res) => {
  try {
    const events = await prisma.taskEvent.findMany({
      where: { taskId: req.params.id },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    return res.json({ events });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/tasks — create a task at client-provided x,y.
// Accepts an optional client-supplied id so undo can restore a deleted task
// with its identity (bubble memberships, dependencies by id) intact.
router.post("/", async (req, res) => {
  try {
    const {
      id, title, description, tags, canvasId, color, dueDate, priority,
      x, y, z, inbox, estimateMinutes, recurrence, snoozedUntil,
      done, archivedAt,
    } = req.body;
    if (!canvasId || !title) return res.status(400).json({ error: "Missing canvasId and/or title" });

    // Deterministic fallback hue from title hash (djb2)
    let h = 5381 >>> 0;
    for (let i = 0; i < title.length; i++) h = (((h << 5) + h) ^ title.charCodeAt(i)) >>> 0;

    const task = await prisma.task.create({
      data: {
        ...(typeof id === "string" && id ? { id } : {}),
        canvasId,
        title,
        description: description || "",
        tags: Array.isArray(tags) ? tags : [],
        color: color || `hsl(${h % 360}, 70%, 55%)`,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || "medium",
        x: typeof x === "number" ? x : 100,
        y: typeof y === "number" ? y : 100,
        z: typeof z === "number" ? z : 0,
        inbox: inbox === true,
        estimateMinutes: typeof estimateMinutes === "number" ? estimateMinutes : null,
        recurrence: typeof recurrence === "string" && recurrence ? recurrence : null,
        snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null,
        done: done === true,
        archivedAt: archivedAt ? new Date(archivedAt) : null,
      },
      include: INCLUDE_CHECKLIST,
    });

    void recordEvent({
      taskId: task.id,
      canvasId: task.canvasId,
      type: "created",
      payload: { title: task.title, x: task.x, y: task.y, color: task.color },
    });
    publish(task.canvasId, { entity: "task", action: "upsert", data: task, clientId: req.header("x-client-id") });

    return res.status(201).json(task);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/tasks/merge { taskIds, title?, x?, y? } — fuse cards into one task
// whose checklist carries each member's title + done state; members archive.
router.post("/merge", async (req, res) => {
  try {
    const { taskIds, title, x, y } = req.body ?? {};
    if (!Array.isArray(taskIds) || taskIds.length < 2)
      return res.status(400).json({ error: "Need at least two taskIds" });

    const members = await prisma.task.findMany({ where: { id: { in: taskIds } } });
    if (members.length < 2) return res.status(404).json({ error: "Tasks not found" });
    const canvasId = members[0].canvasId;
    if (!members.every((m) => m.canvasId === canvasId))
      return res.status(400).json({ error: "Tasks are on different canvases" });

    const prioRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const topPriority = members.reduce(
      (best, m) => ((prioRank[m.priority] ?? 3) < (prioRank[best] ?? 3) ? m.priority : best),
      "low",
    );
    const estimateSum = members.reduce((s, m) => s + (m.estimateMinutes ?? 0), 0);
    const dueDates = members.map((m) => m.dueDate).filter((d): d is Date => !!d);

    const merged = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          canvasId,
          title: typeof title === "string" && title ? title : members[0].title,
          description: "",
          tags: [...new Set(members.flatMap((m) => m.tags))],
          color: members[0].color,
          priority: topPriority,
          estimateMinutes: estimateSum > 0 ? estimateSum : null,
          dueDate: dueDates.length ? new Date(Math.min(...dueDates.map((d) => d.getTime()))) : null,
          x: typeof x === "number" ? x : members.reduce((s, m) => s + m.x, 0) / members.length,
          y: typeof y === "number" ? y : members.reduce((s, m) => s + m.y, 0) / members.length,
          checklist: {
            create: members.map((m, i) => ({ text: m.title, done: m.done, order: i })),
          },
        },
        include: INCLUDE_CHECKLIST,
      });
      await tx.task.updateMany({
        where: { id: { in: taskIds } },
        data: { archivedAt: new Date(), lastActivityAt: new Date() },
      });
      return task;
    });

    void recordEvent({
      taskId: merged.id,
      canvasId,
      type: "created",
      payload: { title: merged.title, mergedFrom: taskIds },
    });
    const clientId = req.header("x-client-id");
    publish(canvasId, { entity: "task", action: "upsert", data: merged, clientId });
    const archivedMembers = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      include: INCLUDE_CHECKLIST,
    });
    for (const m of archivedMembers) {
      publish(canvasId, { entity: "task", action: "upsert", data: m, clientId });
    }

    return res.status(201).json({ task: merged, archived: archivedMembers });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/tasks/:id/split { positions?: [{x,y}] } — explode a task's
// checklist into cards, pinned as a bubble named after the parent.
router.post("/:id/split", async (req, res) => {
  try {
    const parent = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: INCLUDE_CHECKLIST,
    });
    if (!parent) return res.status(404).json({ error: "Task not found" });
    if (parent.checklist.length === 0)
      return res.status(400).json({ error: "No checklist items to split" });

    const positions: Array<{ x: number; y: number }> = Array.isArray(req.body?.positions)
      ? req.body.positions
      : [];

    const result = await prisma.$transaction(async (tx) => {
      const tasks = [];
      for (let i = 0; i < parent.checklist.length; i++) {
        const item = parent.checklist[i];
        const pos = positions[i] ?? { x: parent.x + (i % 3) * 60, y: parent.y + i * 60 };
        tasks.push(
          await tx.task.create({
            data: {
              canvasId: parent.canvasId,
              title: item.text,
              done: item.done,
              description: "",
              tags: parent.tags,
              color: parent.color,
              priority: parent.priority,
              x: pos.x,
              y: pos.y,
              z: i + 1,
            },
            include: INCLUDE_CHECKLIST,
          }),
        );
      }
      const bubble = await tx.bubble.create({
        data: {
          canvasId: parent.canvasId,
          title: parent.title,
          memberIds: tasks.map((t) => t.id),
          pinned: true,
        },
      });
      const archivedParent = await tx.task.update({
        where: { id: parent.id },
        data: { archivedAt: new Date(), lastActivityAt: new Date() },
        include: INCLUDE_CHECKLIST,
      });
      return { tasks, bubble, parent: archivedParent };
    });

    void recordEvents(
      result.tasks.map((t) => ({
        taskId: t.id,
        canvasId: parent.canvasId,
        type: "created" as const,
        payload: { title: t.title, splitFrom: parent.id },
      })),
    );
    const clientId = req.header("x-client-id");
    for (const t of result.tasks) {
      publish(parent.canvasId, { entity: "task", action: "upsert", data: t, clientId });
    }
    publish(parent.canvasId, { entity: "bubble", action: "upsert", data: result.bubble, clientId });
    publish(parent.canvasId, { entity: "task", action: "upsert", data: result.parent, clientId });

    return res.status(201).json(result);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PATCH /api/tasks/:id — update allowed fields (drag position, edits, done,
// archive, snooze, portal moves via canvasId, timer minutes).
const PATCHABLE = new Set([
  "x", "y", "z", "title", "description", "tags", "color", "dueDate", "priority",
  "done", "archivedAt", "inbox", "snoozedUntil", "estimateMinutes", "recurrence",
  "canvasId", "actualMinutes", "status",
]);
const PUSHABLE = ["title", "description", "done", "status"] as const;
const DATE_FIELDS = new Set(["dueDate", "archivedAt", "snoozedUntil"]);
const POSITION_FIELDS = new Set(["x", "y", "z"]);

interface RecurrenceRule {
  unit: "day" | "week" | "month";
  every: number;
}

function parseRecurrence(raw: string | null): RecurrenceRule | null {
  if (!raw) return null;
  try {
    const rule = JSON.parse(raw);
    if (
      (rule.unit === "day" || rule.unit === "week" || rule.unit === "month") &&
      Number.isInteger(rule.every) && rule.every >= 1
    ) {
      return rule;
    }
  } catch { /* malformed rule — ignore */ }
  return null;
}

function advanceDueDate(from: Date, rule: RecurrenceRule): Date {
  const next = new Date(from);
  if (rule.unit === "day") next.setDate(next.getDate() + rule.every);
  else if (rule.unit === "week") next.setDate(next.getDate() + 7 * rule.every);
  else next.setMonth(next.getMonth() + rule.every);
  return next;
}

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Task not found" });

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(req.body ?? {})) {
      if (!PATCHABLE.has(key)) continue;
      if (DATE_FIELDS.has(key) && typeof value === "string") data[key] = new Date(value);
      else data[key] = value;
    }

    if (typeof data.canvasId === "string" && data.canvasId !== existing.canvasId) {
      const target = await prisma.canvas.findUnique({ where: { id: data.canvasId } });
      if (!target) return res.status(400).json({ error: "Target canvas not found" });
    }

    const keys = Object.keys(data);
    const positionOnly = keys.length > 0 && keys.every((k) => POSITION_FIELDS.has(k));
    if (!positionOnly) data.lastActivityAt = new Date();

    const task = await prisma.task.update({
      where: { id },
      data,
      include: INCLUDE_CHECKLIST,
    });

    // Recurring tasks respawn in place when completed.
    const rule = parseRecurrence(task.recurrence);
    const justCompleted = data.done === true && !existing.done;
    let spawned = null;
    if (justCompleted && rule) {
      const base = task.dueDate ?? new Date();
      spawned = await prisma.task.create({
        data: {
          canvasId: task.canvasId,
          title: task.title,
          description: task.description,
          tags: task.tags,
          color: task.color,
          priority: task.priority,
          estimateMinutes: task.estimateMinutes,
          recurrence: task.recurrence,
          x: task.x + 12,
          y: task.y + 12,
          z: task.z + 1,
          dueDate: advanceDueDate(base, rule),
        },
        include: INCLUDE_CHECKLIST,
      });
      void recordEvent({
        taskId: spawned.id,
        canvasId: spawned.canvasId,
        type: "created",
        payload: { title: spawned.title, x: spawned.x, y: spawned.y, recurred: true },
      });
    }

    if (positionOnly) {
      void recordEvent({
        taskId: task.id,
        canvasId: task.canvasId,
        type: "moved",
        payload: {
          x: task.x, y: task.y, z: task.z,
          prev: { x: existing.x, y: existing.y, z: existing.z },
        },
      });
    } else if (keys.length > 0) {
      const prev: Record<string, unknown> = {};
      for (const k of keys) prev[k] = (existing as Record<string, unknown>)[k];
      const isSession = keys.length === 1 && keys[0] === "actualMinutes";
      void recordEvent({
        taskId: task.id,
        canvasId: task.canvasId,
        type: justCompleted ? "completed" : isSession ? "session" : "updated",
        payload: JSON.parse(JSON.stringify({ fields: req.body, prev })),
      });
    }

    const clientId = req.header("x-client-id");
    // A cross-canvas move must be broadcast as a delete on the old board.
    if (task.canvasId !== existing.canvasId) {
      publish(existing.canvasId, { entity: "task", action: "delete", data: { id: task.id }, clientId });
    }
    publish(task.canvasId, { entity: "task", action: "upsert", data: task, clientId });
    if (spawned) publish(task.canvasId, { entity: "task", action: "upsert", data: spawned, clientId });

    // Push local edits of synced tasks to the provider — async, never blocks.
    if (existing.connectionId) {
      const pushFields: Record<string, unknown> = {};
      for (const key of PUSHABLE) if (key in data) pushFields[key] = data[key];
      if (Object.keys(pushFields).length) queuePush(task.id, pushFields);
    }

    return res.json({ ...task, spawned });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /api/tasks/:id — remove permanently (history events are kept)
router.delete("/:id", async (req, res) => {
  try {
    const existing = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: INCLUDE_CHECKLIST,
    });
    if (!existing) return res.status(404).json({ error: "Task not found" });

    await prisma.task.delete({ where: { id: req.params.id } });
    void recordEvent({
      taskId: existing.id,
      canvasId: existing.canvasId,
      type: "deleted",
      payload: { snapshot: existing },
    });
    publish(existing.canvasId, {
      entity: "task", action: "delete", data: { id: existing.id },
      clientId: req.header("x-client-id"),
    });
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// --- Checklist (nested). Every mutation returns the full updated task so the
// client can replace it in one step. ---

async function fullTask(id: string) {
  return prisma.task.findUnique({ where: { id }, include: INCLUDE_CHECKLIST });
}

router.post("/:id/checklist", async (req, res) => {
  try {
    const { text } = req.body ?? {};
    if (!text || typeof text !== "string") return res.status(400).json({ error: "Missing text" });
    const count = await prisma.checklistItem.count({ where: { taskId: req.params.id } });
    await prisma.checklistItem.create({
      data: { taskId: req.params.id, text: text.trim(), order: count },
    });
    const task = await fullTask(req.params.id);
    if (task) publish(task.canvasId, { entity: "task", action: "upsert", data: task, clientId: req.header("x-client-id") });
    return res.status(201).json(task);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.patch("/:id/checklist/:itemId", async (req, res) => {
  try {
    const data: Record<string, unknown> = {};
    const { text, done, order } = req.body ?? {};
    if (typeof text === "string") data.text = text.trim();
    if (typeof done === "boolean") data.done = done;
    if (Number.isInteger(order)) data.order = order;
    await prisma.checklistItem.update({ where: { id: req.params.itemId }, data });

    let task = await fullTask(req.params.id);

    // Autopilot (a): complete the task when its last checklist item checks.
    if (
      task && !task.done && task.checklist.length > 0 &&
      task.checklist.every((c) => c.done)
    ) {
      const settings = await canvasSettings(task.canvasId);
      if (settings.autoCompleteChecklist) {
        task = await prisma.task.update({
          where: { id: task.id },
          data: { done: true, lastActivityAt: new Date() },
          include: INCLUDE_CHECKLIST,
        });
        void recordEvent({
          taskId: task.id,
          canvasId: task.canvasId,
          type: "completed",
          payload: { autopilot: true },
          actor: "autopilot",
        });
        // Autopilot completion of a synced task must reach the provider too.
        if (task.connectionId) queuePush(task.id, { done: true });
      }
    }

    if (task) publish(task.canvasId, { entity: "task", action: "upsert", data: task, clientId: req.header("x-client-id") });
    return res.json(task);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.delete("/:id/checklist/:itemId", async (req, res) => {
  try {
    await prisma.checklistItem.delete({ where: { id: req.params.itemId } });
    const task = await fullTask(req.params.id);
    if (task) publish(task.canvasId, { entity: "task", action: "upsert", data: task, clientId: req.header("x-client-id") });
    return res.json(task);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
