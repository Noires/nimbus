import { computeTidyMoves } from "./tidy";
import { latticePositions } from "./lattice";
import { computeAutoArrange, type ArrangeMode } from "./autoArrange";
import { CARD_H, CARD_W, type Zone } from "../store";
import { selectEffectiveZone } from "../data/spatialZoneSelectors";

const CLUSTER_THRESHOLD = 240;
export const ARRANGE_GAP_X = 16;
export const ARRANGE_GAP_Y = 16;

export interface ArrangementTask {
  id: string;
  x: number;
  y: number;
  title?: string;
  tags?: string[];
  priority?: string;
  status?: string | null;
  dueDate?: string | null;
}

/** Grid reuses the deterministic status lattice, rather than a hidden auto-run. */
export type ArrangementStrategy = "tidy-overlaps" | "grid" | ArrangeMode;

export interface ArrangementWorkstream {
  id: string;
  pinned: boolean;
  protected: boolean;
  taskIds: string[];
}

export type ArrangementScope =
  | { kind: "selected"; taskIds: string[] }
  | { kind: "canvas"; taskIds: string[] }
  | { kind: "workstream"; workstreamId: string; taskIds: string[] }
  | { kind: "selected-zones"; taskIds: string[] };

export interface ArrangementMove {
  id: string;
  x: number;
  y: number;
  /** Present only for selected-zone previews; it is explanation metadata, not membership. */
  zoneId?: string;
  title?: string;
}

export interface SkippedArrangementEntity {
  id: string;
  reason: "missing-task" | "protected-task" | "pinned-workstream" | "protected-workstream" | "outside-zone" | "ambiguous-zone" | "zone-too-small";
  zoneIds?: string[];
  title?: string;
}

export interface ArrangementPreview {
  strategy: ArrangementStrategy;
  scope: ArrangementScope["kind"];
  moved: ArrangementMove[];
  unchanged: string[];
  skipped: SkippedArrangementEntity[];
  positions: ArrangementMove[];
  inverse: ArrangementMove[];
  isNoop: boolean;
  explanation: string;
  explanations: string[];
  /** Snapshot of the task positions and workstream safeguards used for this preview. */
  revision: string;
}

export interface ArrangementPreviewInput {
  scope: ArrangementScope;
  strategy?: ArrangementStrategy;
  tasks: ArrangementTask[];
  /** Task ids that must remain fixed even when the caller selects them. */
  protectedTaskIds?: Iterable<string>;
  zones?: Zone[];
  /** Retained for the in-progress workstream use case; callers may omit it. */
  workstreams?: ArrangementWorkstream[];
  /** Optional revision calculated from the caller's authoritative store state. */
  revision?: string;
}

type RevisionWorkstream = Pick<ArrangementWorkstream, "id" | "pinned" | "protected"> &
  ({ taskIds: Iterable<string> } | { memberships: Iterable<{ taskId: string }> });

/**
 * Produces a stable snapshot identifier for the arrangement inputs. Positions,
 * workstream protection flags, and explicit memberships are all normalized and
 * sorted so equivalent state has the same revision regardless of array order.
 */
export function arrangementRevision(
  tasks: Iterable<ArrangementTask>,
  workstreams: Iterable<RevisionWorkstream>,
  zones: Iterable<Pick<Zone, "id" | "canvasId" | "x" | "y" | "w" | "h" | "label" | "z">> = [],
): string {
  const taskState = [...tasks]
    .map(({ id, x, y }) => [id, x, y] as const)
    .sort(([left], [right]) => compareIds(left, right));
  const workstreamState = [...workstreams]
    .map((workstream) => [
      workstream.id,
      workstream.pinned,
      workstream.protected,
      [...workstreamTaskIds(workstream)].sort(compareIds),
    ] as const)
    .sort(([left], [right]) => compareIds(left, right));
  const zoneState = [...zones].map(({ id, canvasId, x, y, w, h, label, z }) => [id, canvasId, x, y, w, h, label, z] as const).sort(([left], [right]) => compareIds(left, right));
  return JSON.stringify([taskState, workstreamState, zoneState]);
}

/** Returns whether a preview still represents the supplied authoritative state. */
export function isArrangementPreviewCurrent(
  preview: ArrangementPreview,
  tasks: Iterable<ArrangementTask>,
  workstreams: Iterable<RevisionWorkstream>,
  zones: Iterable<Pick<Zone, "id" | "canvasId" | "x" | "y" | "w" | "h" | "label" | "z">> = [],
): boolean {
  return preview.revision === arrangementRevision(tasks, workstreams, zones);
}

/**
 * Computes a side-effect-free, deterministic tidy-overlaps operation. Callers
 * deliberately supply the scope ids, so this function never moves invisible or
 * otherwise out-of-scope cards.
 */
export function previewArrangementOperation(input: ArrangementPreviewInput): ArrangementPreview {
  const strategy = input.strategy ?? "tidy-overlaps";
  const workstreams = input.workstreams ?? [];
  const revision = input.revision ?? arrangementRevision(input.tasks, workstreams, input.scope.kind === "selected-zones" ? input.zones : []);
  const workstreamId = getWorkstreamId(input.scope);
  const scopeWorkstream = workstreamId
    ? workstreams.find((workstream) => workstream.id === workstreamId)
    : undefined;
  if (scopeWorkstream?.protected || scopeWorkstream?.pinned) {
    const reason = scopeWorkstream.protected ? "protected-workstream" : "pinned-workstream";
    return emptyPreview(input.scope.kind, strategy, [{ id: scopeWorkstream.id, reason }], revision);
  }

  const tasksById = new Map(input.tasks.map((task) => [task.id, task]));
  const protectedTaskIds = new Set(input.protectedTaskIds);
  const protectedMemberships = new Map<string, "pinned-workstream" | "protected-workstream">();
  for (const workstream of workstreams) {
    const reason = workstream.protected
      ? "protected-workstream"
      : workstream.pinned
        ? "pinned-workstream"
        : null;
    if (!reason) continue;
    for (const taskId of workstream.taskIds) {
      const existing = protectedMemberships.get(taskId);
      protectedMemberships.set(taskId, existing === "protected-workstream" ? existing : reason);
    }
  }

  const skipped: SkippedArrangementEntity[] = [];
  const candidates: ArrangementTask[] = [];
  for (const taskId of [...new Set(input.scope.taskIds)].sort(compareIds)) {
    const task = tasksById.get(taskId);
    if (!task) {
      skipped.push({ id: taskId, reason: "missing-task" });
      continue;
    }
    const reason = protectedMemberships.get(taskId);
    if (reason) {
      skipped.push({ id: taskId, title: task.title, reason });
      continue;
    }
    if (protectedTaskIds.has(taskId)) {
      skipped.push({ id: taskId, title: task.title, reason: "protected-task" });
      continue;
    }
    candidates.push(task);
  }

  const byId = new Map(candidates.map((task) => [task.id, task]));
  const moves = new Map<string, { x: number; y: number; zoneId?: string }>();
  if (input.scope.kind === "selected-zones") {
    const zoneTasks = new Map<string, ArrangementTask[]>();
    for (const task of candidates) {
      const resolution = selectEffectiveZone(task, input.zones ?? []);
      if (resolution.kind === "outside") { skipped.push({ id: task.id, title: task.title, reason: "outside-zone" }); continue; }
      if (resolution.kind === "ambiguous") { skipped.push({ id: task.id, title: task.title, reason: "ambiguous-zone", zoneIds: resolution.zoneIds }); continue; }
      if (resolution.zone.w < CARD_W || resolution.zone.h < CARD_H) { skipped.push({ id: task.id, title: task.title, reason: "zone-too-small", zoneIds: [resolution.zone.id] }); continue; }
      const group = zoneTasks.get(resolution.zone.id) ?? [];
      group.push(task); zoneTasks.set(resolution.zone.id, group);
    }
    for (const [zoneId, group] of [...zoneTasks].sort(([a], [b]) => compareIds(a, b))) {
      const zone = (input.zones ?? []).find((item) => item.id === zoneId)!;
      const columns = Math.max(1, Math.floor((zone.w - CARD_W) / (CARD_W + ARRANGE_GAP_X)) + 1);
      // A Zone is never resized and no card may be clipped. Capacity is thus
      // deliberately finite: later deterministic rows are explained as skipped
      // instead of spilling beyond the persisted rectangle.
      const rows = Math.max(1, Math.floor((zone.h - CARD_H) / (CARD_H + ARRANGE_GAP_Y)) + 1);
      const capacity = columns * rows;
      [...group].sort((a, b) => a.y - b.y || a.x - b.x || compareIds(a.id, b.id)).forEach((task, index) => {
        if (index >= capacity) {
          skipped.push({ id: task.id, title: task.title, reason: "zone-too-small", zoneIds: [zone.id] });
          return;
        }
        moves.set(task.id, {
          x: zone.x + (index % columns) * (CARD_W + ARRANGE_GAP_X), y: zone.y + Math.floor(index / columns) * (CARD_H + ARRANGE_GAP_Y), zoneId: zone.id,
        });
      });
    }
  } else if (strategy === "tidy-overlaps") {
    const clusters = computeCandidateClusters(candidates);
    for (const cluster of clusters) {
      const members = cluster.members.map((id) => byId.get(id)).filter((task): task is ArrangementTask => !!task);
      if (members.length < 2 || !membersOverlap(members)) continue;
      const center = { x: members.reduce((sum, task) => sum + task.x, 0) / members.length, y: members.reduce((sum, task) => sum + task.y, 0) / members.length };
      const ordered = [...members].sort((a, b) => a.y - b.y || a.x - b.x || compareIds(a.id, b.id));
      latticePositions(center.x, center.y, ordered.length).forEach((position, index) => moves.set(ordered[index].id, { x: Math.round(position.x), y: Math.round(position.y) }));
    }
    const compacted = candidates.map((task) => ({ ...task, ...(moves.get(task.id) ?? {}) }));
    for (const [taskId, position] of computeTidyMoves(compacted, clusters)) moves.set(taskId, position);
  } else {
    const mode: ArrangeMode = strategy === "grid" ? "status" : strategy;
    const arrangeable = candidates.map((task) => ({ ...task, title: task.title ?? "", tags: task.tags ?? [], priority: task.priority ?? "medium", status: task.status ?? null, dueDate: task.dueDate ?? null }));
    for (const [taskId, position] of computeAutoArrange(arrangeable, mode).moves) moves.set(taskId, position);
  }

  const moved: ArrangementMove[] = [];
  const unchanged: string[] = [];
  for (const task of candidates) {
    const plannedPosition = moves.get(task.id);
    const position = plannedPosition ?? task;
    if (position.x === task.x && position.y === task.y) unchanged.push(task.id);
    else moved.push({ id: task.id, x: position.x, y: position.y, ...(plannedPosition?.zoneId ? { zoneId: plannedPosition.zoneId, ...(task.title ? { title: task.title } : {}) } : {}) });
  }
  moved.sort((a, b) => compareIds(a.id, b.id));
  unchanged.sort(compareIds);
  skipped.sort((a, b) => compareIds(a.id, b.id));
  const inverse = moved.map(({ id }) => {
    const task = byId.get(id)!;
    return { id, x: task.x, y: task.y };
  });
  const explanation = moved.length
    ? `${strategy === "tidy-overlaps" ? "Tidy overlaps" : `Arrange by ${strategy}`} will move ${moved.length} of ${candidates.length} eligible cards.`
    : strategy === "tidy-overlaps"
      ? `No overlapping eligible cards need to move (${candidates.length} checked).`
      : `No eligible cards need to move (${candidates.length} checked).`;
  const explanations = [
    explanation,
    ...(skipped.length > 0 ? [`Skipped ${skipped.length} selected cards.`] : []),
  ];
  return {
    strategy,
    scope: input.scope.kind,
    moved,
    unchanged,
    skipped,
    positions: [...moved],
    inverse,
    isNoop: moved.length === 0,
    explanation,
    explanations,
    revision,
  };
}

function membersOverlap(members: ArrangementTask[]): boolean {
  return members.some((a, index) => members.some((b, otherIndex) =>
    otherIndex > index && Math.abs(a.x - b.x) < CARD_W && Math.abs(a.y - b.y) < CARD_H,
  ));
}

function emptyPreview(
  scope: ArrangementScope["kind"],
  strategy: ArrangementStrategy,
  skipped: SkippedArrangementEntity[],
  revision: string,
): ArrangementPreview {
  const explanation = "This protected scope cannot be arranged.";
  return {
    strategy, scope, moved: [], unchanged: [], skipped,
    positions: [], inverse: [], isNoop: true, explanation, explanations: [explanation], revision,
  };
}

function workstreamTaskIds(workstream: RevisionWorkstream): Iterable<string> {
  return "taskIds" in workstream
    ? workstream.taskIds
    : [...workstream.memberships].map((membership) => membership.taskId);
}

function computeCandidateClusters(tasks: ArrangementTask[]): Array<{ id: string; members: string[] }> {
  const ordered = [...tasks].sort((a, b) => compareIds(a.id, b.id));
  const parent = ordered.map((_, index) => index);
  const rank = new Array<number>(ordered.length).fill(0);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    if (rank[leftRoot] < rank[rightRoot]) parent[leftRoot] = rightRoot;
    else if (rank[leftRoot] > rank[rightRoot]) parent[rightRoot] = leftRoot;
    else {
      parent[rightRoot] = leftRoot;
      rank[leftRoot]++;
    }
  };

  for (let left = 0; left < ordered.length; left++) {
    for (let right = left + 1; right < ordered.length; right++) {
      if (Math.hypot(ordered[left].x - ordered[right].x, ordered[left].y - ordered[right].y) <= CLUSTER_THRESHOLD) {
        union(left, right);
      }
    }
  }

  const membersByRoot = new Map<number, string[]>();
  for (let index = 0; index < ordered.length; index++) {
    const root = find(index);
    const members = membersByRoot.get(root) ?? [];
    members.push(ordered[index].id);
    membersByRoot.set(root, members);
  }
  return [...membersByRoot.values()]
    .filter((members) => members.length > 1)
    .map((members) => ({ id: members[0], members }))
    .sort((left, right) => compareIds(left.id, right.id));
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function getWorkstreamId(scope: ArrangementScope): string | undefined {
  return scope.kind === "workstream" ? scope.workstreamId : undefined;
}