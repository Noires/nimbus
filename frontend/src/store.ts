import { create } from "zustand";
import {
  api,
  TaskSchema,
  BubbleSchema,
  DependencySchema,
  PortalSchema,
  ZoneSchema,
  ConnectionSchema,
  type Canvas,
  type Task,
  type TaskPatch,
  type NewTaskInput,
  type Bubble,
  type Dependency,
  type Portal,
  type Zone,
  type Waypoint,
  type CanvasSettings,
  type Connection,
} from "./data/api";
import { history, type Op } from "./engine/history";
import { computeClusters } from "./engine/proximityDetector";
import { computeTidyMoves } from "./engine/tidy";
import { computeAutoArrange, NONE_KEY, type ArrangeMode } from "./engine/autoArrange";
import { latticePositions } from "./engine/lattice";
import { t } from "./i18n";

export type { Canvas, Task, Bubble, Dependency, Portal, Zone, Waypoint, CanvasSettings, Connection };

export interface RemoteEvent {
  entity: "task" | "bubble" | "dependency" | "portal" | "zone" | "canvas" | "connection";
  action: "upsert" | "delete";
  data: unknown;
  clientId?: string;
}

export const CARD_W = 256;
export const CARD_H = 170;
export const DAY_W = 56; // world px per day in the time lens

export type LensMode = "off" | "time" | "gravity" | "heat";

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

interface OpOptions {
  record?: boolean;
}

interface State {
  // --- canvases ---
  canvases: Canvas[];
  loadCanvases: () => Promise<Canvas[]>;
  createCanvas: (name: string) => Promise<Canvas>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;

  // --- tasks ---
  tasks: Task[];
  refreshTasks: (canvasId: string) => Promise<void>;
  addTask: (input: NewTaskInput, opts?: OpOptions) => Promise<Task>;
  patchTask: (id: string, patch: TaskPatch, opts?: OpOptions) => Promise<void>;
  moveTaskLocal: (id: string, x: number, y: number) => void;
  moveTasksLocal: (ids: string[], dx: number, dy: number) => void;
  deleteTask: (id: string, opts?: OpOptions) => Promise<void>;
  arrangeCluster: (memberIds: string[], mode: "due" | "priority") => Promise<void>;
  packCluster: (memberIds: string[]) => Promise<void>;
  commitClusterMove: (memberIds: string[], startPositions: Map<string, { x: number; y: number }>) => Promise<void>;
  tidyCanvas: () => Promise<void>;
  autoArrangeCanvas: (mode: ArrangeMode) => Promise<void>;

  // --- checklist ---
  addChecklistItem: (taskId: string, text: string) => Promise<void>;
  patchChecklistItem: (taskId: string, itemId: string, patch: { text?: string; done?: boolean }) => Promise<void>;
  removeChecklistItem: (taskId: string, itemId: string) => Promise<void>;

  // --- bubbles (server-backed, pinned) ---
  bubbles: Bubble[];
  loadBubbles: (canvasId: string) => Promise<void>;
  pinBubble: (canvasId: string, memberIds: string[], title: string, hue: number) => Promise<void>;
  titleCluster: (canvasId: string, memberIds: string[], title: string) => Promise<void>;
  updateBubble: (id: string, patch: { title?: string; hue?: number | null; memberIds?: string[]; pinned?: boolean }) => Promise<void>;
  removeBubble: (id: string) => Promise<void>;

  // --- dependencies ---
  dependencies: Dependency[];
  loadDependencies: (canvasId: string) => Promise<void>;
  addDependency: (blockerId: string, blockedId: string) => Promise<void>;
  removeDependency: (id: string) => Promise<void>;
  linking: { fromId: string; x: number; y: number } | null;
  setLinking: (linking: { fromId: string; x: number; y: number } | null) => void;

  // --- portals ---
  portals: Portal[];
  loadPortals: (canvasId: string) => Promise<void>;
  addPortal: (canvasId: string, targetCanvasId: string, x: number, y: number) => Promise<void>;
  removePortal: (id: string) => Promise<void>;

  // --- zones ---
  zones: Zone[];
  loadZones: (canvasId: string) => Promise<void>;
  addZone: (input: { canvasId: string; x: number; y: number; w: number; h: number; label?: string; hue?: number; autoTag?: string | null }) => Promise<Zone>;
  patchZone: (id: string, patch: Partial<Omit<Zone, "id" | "canvasId">>) => Promise<void>;
  removeZone: (id: string) => Promise<void>;

  // --- selection (lasso / bulk) ---
  selectedIds: string[];
  setSelected: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  bulkPatch: (ids: string[], patch: TaskPatch, label: string) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;

  // --- fission / fusion ---
  splitTaskAction: (id: string) => Promise<void>;
  mergeTasksAction: (ids: string[], title?: string) => Promise<void>;

  // --- flow fill ---
  autoScheduleTasks: (ids: string[]) => Promise<void>;

  // --- waypoints ---
  saveWaypoint: (canvasId: string, slot: number) => Promise<void>;
  gotoWaypoint: (canvasId: string, slot: number) => void;

  // --- view mode & day filter ---
  viewMode: "canvas" | "table";
  setViewMode: (mode: "canvas" | "table") => void;
  cardDensity: "full" | "mini";
  setCardDensity: (density: "full" | "mini", canvasId?: string) => void;
  dayFilter: string | null;
  setDayFilter: (day: string | null) => void;
  zoneDraw: boolean;
  setZoneDraw: (on: boolean) => void;
  dayDockOpen: boolean;
  setDayDockOpen: (open: boolean) => void;

  // --- external connections (GitHub etc.) ---
  connections: Connection[];
  loadConnections: (canvasId: string) => Promise<void>;
  addConnection: (input: { provider: string; canvasId: string; config: Record<string, unknown>; pollMinutes?: number }) => Promise<Connection>;
  patchConnection: (id: string, patch: { config?: Record<string, unknown>; pollMinutes?: number; enabled?: boolean }) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
  syncConnection: (id: string) => Promise<void>;

  // --- live sync & sharing ---
  readOnly: boolean;
  liveConnected: boolean;
  setLiveConnected: (connected: boolean) => void;
  applyRemote: (event: RemoteEvent) => void;
  loadSharedSnapshot: (token: string) => Promise<string>;

  // --- ui / filters ---
  draggingTaskId: string | null;
  setDragging: (id: string | null) => void;
  showDone: boolean;
  toggleShowDone: () => void;
  showArchived: boolean;
  toggleShowArchived: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  lens: LensMode;
  setLens: (lens: LensMode) => void;
  timeOriginX: number | null;
  flashTaskId: string | null;
  flashTask: (id: string) => void;
  toast: { message: string; id: number } | null;
  showToast: (message: string) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  inboxOpen: boolean;
  setInboxOpen: (open: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;

  // --- focus mode ---
  focus: { members: string[]; index: number; prevView: ViewState } | null;
  startFocus: (members: string[]) => void;
  stepFocus: (delta: number) => void;
  exitFocus: () => void;

  // --- review flight ---
  review: { queue: string[]; index: number; cleared: number; rescheduled: number; archived: number } | null;
  setReview: (review: State["review"]) => void;

  // --- timelapse replay ---
  replayTasks: Task[] | null;
  setReplayTasks: (tasks: Task[] | null) => void;

  // --- view ---
  zoom: number;
  panX: number;
  panY: number;
  viewportW: number;
  viewportH: number;
  setViewport: (w: number, h: number) => void;
  setView: (zoom: number, panX: number, panY: number) => void;
  fitView: (viewportW?: number, viewportH?: number) => void;
  flyTo: (worldX: number, worldY: number, zoom?: number) => void;

  // --- undo/redo ---
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

function taskToInput(task: Task): NewTaskInput & TaskPatch {
  return {
    id: task.id,
    canvasId: task.canvasId,
    title: task.title,
    description: task.description,
    tags: task.tags,
    color: task.color,
    dueDate: task.dueDate,
    priority: task.priority,
    x: task.x,
    y: task.y,
    z: task.z,
    inbox: task.inbox,
    estimateMinutes: task.estimateMinutes,
    recurrence: task.recurrence,
    done: task.done,
    archivedAt: task.archivedAt,
  } as NewTaskInput & TaskPatch;
}

function patchLabel(task: Task | undefined, patch: TaskPatch): string {
  const title = task?.title ?? t("label.task");
  const keys = Object.keys(patch);
  if (keys.every((k) => k === "x" || k === "y" || k === "z")) return t("label.moved", { title });
  if ("done" in patch) return t(patch.done ? "label.completed" : "label.reopened", { title });
  if ("archivedAt" in patch) return t(patch.archivedAt ? "label.archived" : "label.restored", { title });
  if ("snoozedUntil" in patch) return t(patch.snoozedUntil ? "label.snoozed" : "label.woke", { title });
  if ("canvasId" in patch) return t("label.portalMove", { title });
  return t("label.edited", { title });
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let flyRaf = 0;
let toastSeq = 0;

export const useStore = create<State>((set, get) => {
  // Execute an op in the given direction without recording history.
  async function applyOp(op: Op, dir: "undo" | "redo"): Promise<void> {
    if (op.kind === "patch") {
      await get().patchTask(op.taskId, dir === "undo" ? op.undo : op.redo, { record: false });
    } else if (op.kind === "create") {
      if (dir === "undo") await get().deleteTask(op.task.id, { record: false });
      else await get().addTask(taskToInput(op.task), { record: false });
    } else if (op.kind === "delete") {
      if (dir === "undo") await get().addTask(taskToInput(op.task), { record: false });
      else await get().deleteTask(op.task.id, { record: false });
    } else {
      const ops = dir === "undo" ? [...op.ops].reverse() : op.ops;
      for (const sub of ops) await applyOp(sub, dir);
    }
  }

  return {
    // --- canvases ---
    canvases: [],
    loadCanvases: async () => {
      const canvases = await api.listCanvases();
      set({ canvases });
      return canvases;
    },
    createCanvas: async (name) => {
      const canvas = await api.createCanvas(name);
      set({ canvases: [canvas, ...get().canvases] });
      return canvas;
    },
    renameCanvas: async (id, name) => {
      const saved = await api.updateCanvas(id, { name });
      set({ canvases: get().canvases.map((c) => (c.id === id ? saved : c)) });
    },
    deleteCanvas: async (id) => {
      await api.deleteCanvas(id);
      set({ canvases: get().canvases.filter((c) => c.id !== id) });
    },

    // --- tasks ---
    tasks: [],
    refreshTasks: async (canvasId) => {
      const { tasks } = await api.listTasks(canvasId, { archived: true });
      set({ tasks });
    },
    addTask: async (input, opts) => {
      const task = await api.createTask(input);
      set({ tasks: [...get().tasks.filter((t) => t.id !== task.id), task] });
      if (opts?.record !== false) {
        history.push({ op: { kind: "create", task }, label: t("label.created", { title: task.title }) });
      }
      return task;
    },
    patchTask: async (id, patch, opts) => {
      const before = get().tasks.find((t) => t.id === id);
      if (opts?.record !== false && before) {
        const undoPatch: TaskPatch = {};
        for (const key of Object.keys(patch) as (keyof TaskPatch)[]) {
          (undoPatch as Record<string, unknown>)[key] = before[key as keyof Task];
        }
        history.push({
          op: { kind: "patch", taskId: id, redo: patch, undo: undoPatch },
          label: patchLabel(before, patch),
        });
      }
      // Optimistic local update, then reconcile with the server response.
      set({ tasks: get().tasks.map((t) => (t.id === id ? ({ ...t, ...patch } as Task) : t)) });
      const saved = await api.updateTask(id, patch);
      // Moving to another canvas removes the card from this board.
      const activeCanvasTasks = get().tasks.filter((t) => t.id !== id);
      if (before && saved.canvasId !== before.canvasId) {
        set({ tasks: activeCanvasTasks });
      } else {
        set({ tasks: [...activeCanvasTasks, saved] });
      }
      // A completed recurring task spawns a successor server-side — refetch.
      if (patch.done === true && before?.recurrence) {
        await get().refreshTasks(before.canvasId);
      }
      // Unblock detection: completing a blocker frees its dependents.
      if (patch.done === true && before) {
        const s = get();
        const freed = s.dependencies
          .filter((d) => d.blockerId === id)
          .map((d) => d.blockedId)
          .filter((blockedId) =>
            s.dependencies
              .filter((d) => d.blockedId === blockedId && d.blockerId !== id)
              .every((d) => s.tasks.find((t) => t.id === d.blockerId)?.done !== false),
          );
        if (freed.length > 0) {
          const first = s.tasks.find((t) => t.id === freed[0]);
          s.showToast(
            freed.length === 1 && first
              ? t("toast.unlockedOne", { title: first.title })
              : t("toast.unlockedMany", { count: freed.length }),
          );
          for (const freedId of freed) s.flashTask(freedId);
          const canvas = s.canvases.find((c) => c.id === before.canvasId);
          if ((canvas?.settings as CanvasSettings | undefined)?.notifyUnblocked && first) {
            const { notify } = await import("./utils/notifications");
            notify("Task unblocked", first.title, first.id);
          }
        }
      }
    },
    moveTaskLocal: (id, x, y) => {
      set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, x, y } : t)) });
    },
    moveTasksLocal: (ids, dx, dy) => {
      const idSet = new Set(ids);
      set({
        tasks: get().tasks.map((t) => (idSet.has(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t)),
      });
    },
    deleteTask: async (id, opts) => {
      const task = get().tasks.find((t) => t.id === id);
      await api.deleteTask(id);
      set({ tasks: get().tasks.filter((t) => t.id !== id) });
      if (opts?.record !== false && task) {
        history.push({ op: { kind: "delete", task }, label: t("label.deleted", { title: task.title }) });
      }
    },

    arrangeCluster: async (memberIds, mode) => {
      const ids = new Set(memberIds);
      const members = get().tasks.filter((t) => ids.has(t.id));
      if (members.length < 2) return;

      const prioRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const due = (t: Task) => (t.dueDate ? Date.parse(t.dueDate) : Number.MAX_SAFE_INTEGER);
      const prio = (t: Task) => prioRank[t.priority] ?? 3;
      const sorted = [...members].sort((a, b) =>
        mode === "due"
          ? due(a) - due(b) || prio(a) - prio(b) || a.title.localeCompare(b.title)
          : prio(a) - prio(b) || due(a) - due(b) || a.title.localeCompare(b.title),
      );

      // Stack vertically. The 190px pitch keeps consecutive cards inside the
      // 240px clustering threshold, so the bubble survives the rearrange.
      const DY = 190;
      const cx = members.reduce((s, t) => s + t.x, 0) / members.length;
      const cy = members.reduce((s, t) => s + t.y, 0) / members.length;
      const startY = cy - ((sorted.length - 1) * DY) / 2;

      const ops: Op[] = sorted.map((t, i) => ({
        kind: "patch",
        taskId: t.id,
        redo: { x: cx, y: startY + i * DY, z: i + 1 },
        undo: { x: t.x, y: t.y, z: t.z },
      }));
      history.push({ op: { kind: "batch", ops }, label: t("label.arranged") });

      await Promise.all(
        sorted.map((t, i) =>
          get().patchTask(t.id, { x: cx, y: startY + i * DY, z: i + 1 }, { record: false }),
        ),
      );
    },

    packCluster: async (memberIds) => {
      const ids = new Set(memberIds);
      const members = get().tasks.filter((t) => ids.has(t.id));
      if (members.length < 2) return;

      const cx = members.reduce((s, t) => s + t.x, 0) / members.length;
      const cy = members.reduce((s, t) => s + t.y, 0) / members.length;
      const positions = latticePositions(cx, cy, members.length);

      const ops: Op[] = members.map((t, i) => ({
        kind: "patch",
        taskId: t.id,
        redo: { x: positions[i].x, y: positions[i].y },
        undo: { x: t.x, y: t.y },
      }));
      history.push({ op: { kind: "batch", ops }, label: t("label.packed") });

      await Promise.all(
        members.map((t, i) =>
          get().patchTask(t.id, { x: positions[i].x, y: positions[i].y }, { record: false }),
        ),
      );
    },

    tidyCanvas: async () => {
      const { tasks, showDone, showArchived } = get();
      const shown = visibleTasks(tasks, showDone, showArchived);
      if (shown.length < 2) return;

      const clusters = computeClusters(shown, []);
      const byId = new Map(shown.map((t) => [t.id, t]));

      // Phase 1: snap each cluster's members onto the overlap-free lattice
      // around the cluster centroid. Assignment follows the current reading
      // order (top-to-bottom, left-to-right) so cards move as little as
      // possible; the bubble itself survives because lattice neighbors stay
      // inside the 240px proximity threshold. Clusters that are already
      // overlap-free keep their hand-made arrangement (and re-running tidy
      // stays a no-op).
      const moves = new Map<string, { x: number; y: number }>();
      for (const cluster of clusters) {
        const members = cluster.members
          .map((id) => byId.get(id))
          .filter((m): m is Task => !!m);
        if (members.length < 2) continue;
        const hasOverlap = members.some((a, i) =>
          members.some(
            (b, j) => j > i && Math.abs(a.x - b.x) < CARD_W && Math.abs(a.y - b.y) < CARD_H,
          ),
        );
        if (!hasOverlap) continue;
        const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
        const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
        const ordered = [...members].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
        const positions = latticePositions(cx, cy, ordered.length);
        ordered.forEach((member, i) => {
          moves.set(member.id, { x: Math.round(positions[i].x), y: Math.round(positions[i].y) });
        });
      }

      // Phase 2: separate whole groups on the compacted positions.
      const compacted = shown.map((task) => ({ ...task, ...(moves.get(task.id) ?? {}) }));
      for (const [taskId, pos] of computeTidyMoves(compacted, clusters)) moves.set(taskId, pos);

      // Drop no-ops against the ORIGINAL positions.
      for (const [taskId, pos] of [...moves]) {
        const before = byId.get(taskId)!;
        if (before.x === pos.x && before.y === pos.y) moves.delete(taskId);
      }
      if (moves.size === 0) {
        get().showToast(t("toast.tidyNoop"));
        return;
      }

      const ops: Op[] = [...moves.entries()].map(([taskId, pos]) => {
        const before = byId.get(taskId)!;
        return { kind: "patch", taskId, redo: pos, undo: { x: before.x, y: before.y } };
      });
      history.push({ op: { kind: "batch", ops }, label: t("label.tidied") });

      await Promise.all(
        [...moves.entries()].map(([taskId, pos]) => get().patchTask(taskId, pos, { record: false })),
      );
      get().showToast(t("toast.tidied", { count: moves.size }));
    },

    autoArrangeCanvas: async (mode) => {
      const { tasks, showDone, showArchived } = get();
      const shown = visibleTasks(tasks, showDone, showArchived);
      if (shown.length < 2) return;

      const { moves, groups } = computeAutoArrange(shown, mode);
      const byId = new Map(shown.map((t) => [t.id, t]));
      const ops: Op[] = [...moves.entries()].map(([taskId, pos]) => {
        const before = byId.get(taskId)!;
        return { kind: "patch", taskId, redo: pos, undo: { x: before.x, y: before.y } };
      });
      if (ops.length > 0) {
        history.push({ op: { kind: "batch", ops }, label: t("label.autoArranged") });
        await Promise.all(
          [...moves.entries()].map(([taskId, pos]) => get().patchTask(taskId, pos, { record: false })),
        );
      }

      // Name the resulting bubbles after their group. Bubble metadata is not
      // part of the undo history (matches all other bubble actions).
      const canvasId = shown[0].canvasId;
      const labelFor = (key: string): string => {
        if (mode === "priority") return t(`b.priority.${key}`);
        if (mode === "due") return t(`arrange.due.${key === NONE_KEY ? "none" : key}`);
        if (key === NONE_KEY) return t(mode === "tag" ? "arrange.none.tag" : "arrange.none.status");
        return key;
      };
      for (const group of groups) {
        if (group.memberIds.length < 2) continue;
        try {
          await get().titleCluster(canvasId, group.memberIds, labelFor(group.key));
        } catch (e) {
          console.error(e);
        }
      }

      get().fitView();
      get().showToast(t("toast.autoArranged", { count: groups.length }));
    },

    commitClusterMove: async (memberIds, startPositions) => {
      const ids = new Set(memberIds);
      const members = get().tasks.filter((t) => ids.has(t.id));
      const ops: Op[] = [];
      for (const t of members) {
        const start = startPositions.get(t.id);
        if (!start || (start.x === t.x && start.y === t.y)) continue;
        ops.push({
          kind: "patch",
          taskId: t.id,
          redo: { x: t.x, y: t.y },
          undo: { x: start.x, y: start.y },
        });
      }
      if (ops.length === 0) return;
      history.push({ op: { kind: "batch", ops }, label: t("label.movedBubble") });
      await Promise.all(
        members.map((t) => get().patchTask(t.id, { x: t.x, y: t.y }, { record: false })),
      );
    },

    // --- checklist ---
    addChecklistItem: async (taskId, text) => {
      const task = await api.addChecklistItem(taskId, text);
      set({ tasks: get().tasks.map((t) => (t.id === taskId ? task : t)) });
    },
    patchChecklistItem: async (taskId, itemId, patch) => {
      const task = await api.updateChecklistItem(taskId, itemId, patch);
      set({ tasks: get().tasks.map((t) => (t.id === taskId ? task : t)) });
    },
    removeChecklistItem: async (taskId, itemId) => {
      const task = await api.deleteChecklistItem(taskId, itemId);
      set({ tasks: get().tasks.map((t) => (t.id === taskId ? task : t)) });
    },

    // --- bubbles ---
    bubbles: [],
    loadBubbles: async (canvasId) => {
      let bubbles = await api.listBubbles(canvasId);
      // One-time migration of legacy localStorage titles to the server.
      if (bubbles.length === 0) {
        try {
          const raw = localStorage.getItem(`bubble-titles:${canvasId}`);
          const legacy: Array<{ members: string[]; title: string }> = raw ? JSON.parse(raw) : [];
          for (const entry of legacy) {
            if (entry.title && entry.members?.length >= 2) {
              bubbles.push(
                await api.createBubble({ canvasId, title: entry.title, memberIds: entry.members }),
              );
            }
          }
          if (legacy.length) localStorage.removeItem(`bubble-titles:${canvasId}`);
        } catch {
          /* legacy titles are a nicety */
        }
      }
      set({ bubbles });
    },
    pinBubble: async (canvasId, memberIds, title, hue) => {
      const existing = bestBubbleMatch(get().bubbles, memberIds);
      if (existing) {
        const saved = await api.updateBubble(existing.id, { memberIds, title, hue, pinned: true });
        set({ bubbles: get().bubbles.map((b) => (b.id === existing.id ? saved : b)) });
      } else {
        const created = await api.createBubble({ canvasId, title, hue, memberIds, pinned: true });
        set({ bubbles: [...get().bubbles, created] });
      }
    },
    titleCluster: async (canvasId, memberIds, title) => {
      const existing = bestBubbleMatch(get().bubbles, memberIds);
      if (existing) {
        const saved = await api.updateBubble(existing.id, { title, memberIds });
        set({ bubbles: get().bubbles.map((b) => (b.id === existing.id ? saved : b)) });
      } else if (title) {
        const created = await api.createBubble({ canvasId, title, memberIds });
        set({ bubbles: [...get().bubbles, created] });
      }
    },
    updateBubble: async (id, patch) => {
      const saved = await api.updateBubble(id, patch);
      set({ bubbles: get().bubbles.map((b) => (b.id === id ? saved : b)) });
    },
    removeBubble: async (id) => {
      await api.deleteBubble(id);
      set({ bubbles: get().bubbles.filter((b) => b.id !== id) });
    },

    // --- dependencies ---
    dependencies: [],
    loadDependencies: async (canvasId) => {
      set({ dependencies: await api.listDependencies(canvasId) });
    },
    addDependency: async (blockerId, blockedId) => {
      try {
        const dep = await api.createDependency(blockerId, blockedId);
        set({ dependencies: [...get().dependencies, dep] });
      } catch (e) {
        get().showToast((e as Error).message.includes("cycle") ? "That would create a cycle" : "Could not link tasks");
      }
    },
    removeDependency: async (id) => {
      await api.deleteDependency(id);
      set({ dependencies: get().dependencies.filter((d) => d.id !== id) });
    },
    linking: null,
    setLinking: (linking) => set({ linking }),

    // --- portals ---
    portals: [],
    loadPortals: async (canvasId) => {
      set({ portals: await api.listPortals(canvasId) });
    },
    addPortal: async (canvasId, targetCanvasId, x, y) => {
      const portal = await api.createPortal({ canvasId, targetCanvasId, x, y });
      set({ portals: [...get().portals, portal] });
    },
    removePortal: async (id) => {
      await api.deletePortal(id);
      set({ portals: get().portals.filter((p) => p.id !== id) });
    },

    // --- zones ---
    zones: [],
    loadZones: async (canvasId) => {
      set({ zones: await api.listZones(canvasId) });
    },
    addZone: async (input) => {
      const zone = await api.createZone(input);
      set({ zones: [...get().zones, zone] });
      return zone;
    },
    patchZone: async (id, patch) => {
      set({ zones: get().zones.map((z) => (z.id === id ? ({ ...z, ...patch } as Zone) : z)) });
      const saved = await api.updateZone(id, patch);
      set({ zones: get().zones.map((z) => (z.id === id ? saved : z)) });
    },
    removeZone: async (id) => {
      await api.deleteZone(id);
      set({ zones: get().zones.filter((z) => z.id !== id) });
    },

    // --- selection ---
    selectedIds: [],
    setSelected: (ids) => set({ selectedIds: ids }),
    toggleSelected: (id) => {
      const current = get().selectedIds;
      set({
        selectedIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      });
    },
    clearSelection: () => set({ selectedIds: [] }),
    bulkPatch: async (ids, patch, label) => {
      const targets = get().tasks.filter((t) => ids.includes(t.id));
      if (targets.length === 0) return;
      const ops: Op[] = targets.map((t) => {
        const undo: TaskPatch = {};
        for (const key of Object.keys(patch) as (keyof TaskPatch)[]) {
          (undo as Record<string, unknown>)[key] = t[key as keyof Task];
        }
        return { kind: "patch", taskId: t.id, redo: patch, undo };
      });
      history.push({ op: { kind: "batch", ops }, label });
      await Promise.all(targets.map((t) => get().patchTask(t.id, patch, { record: false })));
    },
    bulkDelete: async (ids) => {
      const targets = get().tasks.filter((t) => ids.includes(t.id));
      if (targets.length === 0) return;
      const ops: Op[] = targets.map((t) => ({ kind: "delete", task: t }));
      history.push({ op: { kind: "batch", ops }, label: `deleted ${targets.length} tasks` });
      set({ selectedIds: [] });
      await Promise.all(targets.map((t) => get().deleteTask(t.id, { record: false })));
    },

    // --- fission / fusion ---
    splitTaskAction: async (id) => {
      const parent = get().tasks.find((t) => t.id === id);
      if (!parent || parent.checklist.length === 0) return;
      const positions = latticePositions(parent.x, parent.y, parent.checklist.length);
      const { tasks, parent: archivedParent } = await api.splitTask(id, positions);
      set({
        tasks: [...get().tasks.filter((t) => t.id !== id), archivedParent, ...tasks],
      });
      await get().loadBubbles(parent.canvasId);
      // One undo step: unarchive parent + delete the fragments (reverse order).
      const ops: Op[] = [
        { kind: "patch", taskId: id, redo: { archivedAt: archivedParent.archivedAt }, undo: { archivedAt: null } },
        ...tasks.map((t): Op => ({ kind: "create", task: t })),
      ];
      history.push({ op: { kind: "batch", ops }, label: `split '${parent.title}'` });
      get().showToast(t("toast.split", { count: tasks.length }));
    },
    mergeTasksAction: async (ids, title) => {
      const members = get().tasks.filter((t) => ids.includes(t.id));
      if (members.length < 2) return;
      const { task, archived } = await api.mergeTasks(ids, title);
      const archivedIds = new Set(archived.map((a) => a.id));
      set({
        tasks: [...get().tasks.filter((t) => !archivedIds.has(t.id)), ...archived, task],
        selectedIds: [],
      });
      const ops: Op[] = [
        { kind: "create", task },
        ...members.map((m): Op => ({
          kind: "patch",
          taskId: m.id,
          redo: { archivedAt: new Date().toISOString() },
          undo: { archivedAt: m.archivedAt },
        })),
      ];
      history.push({ op: { kind: "batch", ops }, label: `merged ${members.length} tasks` });
      get().showToast(t("toast.merged", { title: task.title, count: task.checklist.length }));
    },

    // --- flow fill ---
    autoScheduleTasks: async (ids) => {
      const s = get();
      const targets = s.tasks.filter(
        (t) => ids.includes(t.id) && !t.done && !t.archivedAt && !t.inbox,
      );
      if (targets.length === 0) {
        s.showToast(t("toast.nothingToSchedule"));
        return;
      }
      // Respect what's already committed by everything outside this fill.
      const others = s.tasks.filter((t) => !ids.includes(t.id));
      const { autoSchedule } = await import("./utils/autoSchedule");
      const { loadByDay } = await import("./utils/capacity");
      const plan = autoSchedule(targets, s.dependencies, { baseLoad: loadByDay(others) });

      const ops: Op[] = targets
        .filter((t) => plan.has(t.id))
        .map((t) => ({
          kind: "patch",
          taskId: t.id,
          redo: { dueDate: plan.get(t.id)! },
          undo: { dueDate: t.dueDate },
        }));
      history.push({ op: { kind: "batch", ops }, label: `scheduled ${ops.length} tasks` });

      // Watch it happen: flip into the time lens before the cards fly.
      if (s.lens !== "time") s.setLens("time");
      s.clearSelection();
      await Promise.all(
        targets.map((t) =>
          plan.has(t.id)
            ? get().patchTask(t.id, { dueDate: plan.get(t.id)! }, { record: false })
            : Promise.resolve(),
        ),
      );
      get().showToast(t("toast.flowFilled", { count: ops.length }));
    },

    // --- waypoints ---
    saveWaypoint: async (canvasId, slot) => {
      const { zoom, panX, panY } = get();
      const canvas = get().canvases.find((c) => c.id === canvasId);
      const existing: Waypoint[] = Array.isArray(canvas?.viewpoints)
        ? (canvas!.viewpoints as Waypoint[])
        : [];
      const viewpoints = [...existing.filter((w) => w.slot !== slot), { slot, zoom, panX, panY }];
      const saved = await api.updateCanvas(canvasId, { viewpoints });
      set({ canvases: get().canvases.map((c) => (c.id === canvasId ? saved : c)) });
      get().showToast(t("toast.waypointSaved", { slot }));
    },
    gotoWaypoint: (canvasId, slot) => {
      const canvas = get().canvases.find((c) => c.id === canvasId);
      const waypoints: Waypoint[] = Array.isArray(canvas?.viewpoints)
        ? (canvas!.viewpoints as Waypoint[])
        : [];
      const wp = waypoints.find((w) => w.slot === slot);
      if (!wp) return;
      // Convert the saved framing to a world center so flyTo tweens smoothly.
      const { viewportW, viewportH } = get();
      const cx = (viewportW / 2 - wp.panX) / wp.zoom;
      const cy = (viewportH / 2 - wp.panY) / wp.zoom;
      get().flyTo(cx, cy, wp.zoom);
    },

    // --- view mode & day filter ---
    viewMode: "canvas",
    setViewMode: (mode) => set({ viewMode: mode }),
    cardDensity: "full",
    setCardDensity: (density, canvasId) => {
      set({ cardDensity: density });
      // Persist per canvas in the settings JSON; fire-and-forget.
      if (!canvasId) return;
      const canvas = get().canvases.find((c) => c.id === canvasId);
      const settings = { ...((canvas?.settings as CanvasSettings) ?? {}), cardDensity: density };
      api
        .updateCanvas(canvasId, { settings })
        .then((saved) => set({ canvases: get().canvases.map((c) => (c.id === canvasId ? saved : c)) }))
        .catch((e) => console.error(e));
    },
    dayFilter: null,
    setDayFilter: (day) => set({ dayFilter: day }),
    zoneDraw: false,
    setZoneDraw: (on) => set({ zoneDraw: on }),
    dayDockOpen: false,
    setDayDockOpen: (open) => set({ dayDockOpen: open, ...(open ? {} : { dayFilter: null }) }),

    // --- external connections ---
    connections: [],
    loadConnections: async (canvasId) => {
      set({ connections: await api.listConnections(canvasId) });
    },
    addConnection: async (input) => {
      const connection = await api.createConnection(input);
      set({ connections: [...get().connections, connection] });
      return connection;
    },
    patchConnection: async (id, patch) => {
      const saved = await api.updateConnection(id, patch);
      set({ connections: get().connections.map((c) => (c.id === id ? saved : c)) });
    },
    removeConnection: async (id) => {
      await api.deleteConnection(id);
      set({ connections: get().connections.filter((c) => c.id !== id) });
    },
    syncConnection: async (id) => {
      try {
        const summary = await api.syncConnection(id);
        const conn = get().connections.find((c) => c.id === id);
        const config = conn?.config as { owner?: string; repo?: string } | undefined;
        get().showToast(
          t("toast.synced", {
            repo: `${config?.owner ?? ""}/${config?.repo ?? ""}`,
            imported: summary.imported,
            updated: summary.updated,
            pushed: summary.pushed,
          }),
        );
      } catch (e) {
        get().showToast(t("toast.syncFailed", { message: (e as Error).message.slice(0, 120) }));
        throw e;
      }
    },

    // --- live sync & sharing ---
    readOnly: false,
    liveConnected: false,
    setLiveConnected: (connected) => set({ liveConnected: connected }),
    applyRemote: (event) => {
      try {
        const s = get();
        if (event.entity === "task") {
          if (event.action === "delete") {
            const { id } = event.data as { id: string };
            set({ tasks: s.tasks.filter((t) => t.id !== id) });
            return;
          }
          const task = TaskSchema.parse(event.data);
          if (s.draggingTaskId === task.id) return; // never fight a local drag
          set({ tasks: [...s.tasks.filter((t) => t.id !== task.id), task] });
        } else if (event.entity === "bubble") {
          if (event.action === "delete") {
            const { id } = event.data as { id: string };
            set({ bubbles: s.bubbles.filter((b) => b.id !== id) });
            return;
          }
          const bubble = BubbleSchema.parse(event.data);
          set({ bubbles: [...s.bubbles.filter((b) => b.id !== bubble.id), bubble] });
        } else if (event.entity === "dependency") {
          if (event.action === "delete") {
            const { id } = event.data as { id: string };
            set({ dependencies: s.dependencies.filter((d) => d.id !== id) });
            return;
          }
          const dep = DependencySchema.parse(event.data);
          set({ dependencies: [...s.dependencies.filter((d) => d.id !== dep.id), dep] });
        } else if (event.entity === "portal") {
          if (event.action === "delete") {
            const { id } = event.data as { id: string };
            set({ portals: s.portals.filter((p) => p.id !== id) });
            return;
          }
          const portal = PortalSchema.parse(event.data);
          set({ portals: [...s.portals.filter((p) => p.id !== portal.id), portal] });
        } else if (event.entity === "zone") {
          if (event.action === "delete") {
            const { id } = event.data as { id: string };
            set({ zones: s.zones.filter((z) => z.id !== id) });
            return;
          }
          const zone = ZoneSchema.parse(event.data);
          set({ zones: [...s.zones.filter((z) => z.id !== zone.id), zone] });
        } else if (event.entity === "connection") {
          if (event.action === "delete") {
            const { id } = event.data as { id: string };
            set({ connections: s.connections.filter((c) => c.id !== id) });
            return;
          }
          const connection = ConnectionSchema.parse(event.data);
          set({ connections: [...s.connections.filter((c) => c.id !== connection.id), connection] });
        }
      } catch (e) {
        console.error("bad live event", e);
      }
    },
    loadSharedSnapshot: async (token) => {
      const snap = await api.shareSnapshot(token);
      set({
        readOnly: true,
        tasks: snap.tasks,
        bubbles: snap.bubbles,
        zones: snap.zones,
        dependencies: snap.dependencies,
        portals: [],
      });
      return snap.canvas.name;
    },

    // --- ui / filters ---
    draggingTaskId: null,
    setDragging: (id) => set({ draggingTaskId: id }),
    showDone: false,
    toggleShowDone: () => set({ showDone: !get().showDone }),
    showArchived: false,
    toggleShowArchived: () => set({ showArchived: !get().showArchived }),
    searchQuery: "",
    setSearchQuery: (q) => set({ searchQuery: q }),
    lens: "off",
    setLens: (lens) => {
      if (lens === "time") {
        // Anchor "today" a third of the way into the current viewport.
        const { panX, zoom, viewportW } = get();
        set({ lens, timeOriginX: (viewportW / 3 - panX) / zoom });
      } else {
        set({ lens, timeOriginX: null });
      }
    },
    timeOriginX: null,
    flashTaskId: null,
    flashTask: (id) => {
      set({ flashTaskId: id });
      setTimeout(() => {
        if (get().flashTaskId === id) set({ flashTaskId: null });
      }, 1800);
    },
    toast: null,
    showToast: (message) => set({ toast: { message, id: ++toastSeq } }),
    paletteOpen: false,
    setPaletteOpen: (open) => set({ paletteOpen: open }),
    inboxOpen: false,
    setInboxOpen: (open) => set({ inboxOpen: open }),
    helpOpen: false,
    setHelpOpen: (open) => set({ helpOpen: open }),

    // --- focus mode ---
    focus: null,
    startFocus: (members) => {
      if (members.length === 0) return;
      const { zoom, panX, panY } = get();
      set({ focus: { members, index: 0, prevView: { zoom, panX, panY } } });
      const first = get().tasks.find((t) => t.id === members[0]);
      if (first) get().flyTo(first.x + CARD_W / 2, first.y + CARD_H / 2, 1);
    },
    stepFocus: (delta) => {
      const focus = get().focus;
      if (!focus) return;
      const index = (focus.index + delta + focus.members.length) % focus.members.length;
      set({ focus: { ...focus, index } });
      const task = get().tasks.find((t) => t.id === focus.members[index]);
      if (task) get().flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, 1);
    },
    exitFocus: () => {
      const focus = get().focus;
      if (!focus) return;
      set({ focus: null });
      const { zoom, panX, panY } = focus.prevView;
      cancelAnimationFrame(flyRaf);
      set({ zoom, panX, panY });
    },

    // --- review flight ---
    review: null,
    setReview: (review) => set({ review }),

    // --- timelapse ---
    replayTasks: null,
    setReplayTasks: (tasks) => set({ replayTasks: tasks }),

    // --- view ---
    zoom: 1,
    panX: 0,
    panY: 0,
    viewportW: 1200,
    viewportH: 800,
    setViewport: (w, h) => set({ viewportW: w, viewportH: h }),
    setView: (zoom, panX, panY) => {
      cancelAnimationFrame(flyRaf);
      set({ zoom, panX, panY });
    },
    fitView: (w, h) => {
      const viewportW = w ?? get().viewportW;
      const viewportH = h ?? get().viewportH;
      const { tasks, showDone, showArchived } = get();
      const shown = visibleTasks(tasks, showDone, showArchived);
      if (shown.length === 0) return;

      const margin = 60;
      const minX = Math.min(...shown.map((t) => t.x)) - margin;
      const maxX = Math.max(...shown.map((t) => t.x + CARD_W)) + margin;
      const minY = Math.min(...shown.map((t) => t.y)) - margin;
      const maxY = Math.max(...shown.map((t) => t.y + CARD_H)) + margin;

      const zoom = Math.min(
        Math.max(Math.min(viewportW / (maxX - minX), viewportH / (maxY - minY)), 0.2),
        1.5,
      );
      get().setView(
        zoom,
        (viewportW - (maxX - minX) * zoom) / 2 - minX * zoom,
        (viewportH - (maxY - minY) * zoom) / 2 - minY * zoom,
      );
    },
    flyTo: (worldX, worldY, targetZoom = 1) => {
      const { viewportW, viewportH, zoom, panX, panY } = get();
      const targetPanX = viewportW / 2 - worldX * targetZoom;
      const targetPanY = viewportH / 2 - worldY * targetZoom;
      cancelAnimationFrame(flyRaf);
      const start = performance.now();
      const [z0, px0, py0] = [zoom, panX, panY];
      const DURATION = 500;
      const step = (t: number) => {
        const p = Math.min((t - start) / DURATION, 1);
        const e = easeInOutCubic(p);
        set({
          zoom: z0 + (targetZoom - z0) * e,
          panX: px0 + (targetPanX - px0) * e,
          panY: py0 + (targetPanY - py0) * e,
        });
        if (p < 1) flyRaf = requestAnimationFrame(step);
      };
      flyRaf = requestAnimationFrame(step);
    },

    // --- undo/redo ---
    undo: async () => {
      const entry = history.takeUndo();
      if (!entry) return;
      try {
        await applyOp(entry.op, "undo");
        get().showToast(t("undo.undid", { label: entry.label }));
      } catch (e) {
        console.error(e);
        get().showToast(t("undo.failed"));
      }
    },
    redo: async () => {
      const entry = history.takeRedo();
      if (!entry) return;
      try {
        await applyOp(entry.op, "redo");
        get().showToast(t("undo.redid", { label: entry.label }));
      } catch (e) {
        console.error(e);
        get().showToast(t("redo.failed"));
      }
    },
  };
});

// Tasks currently visible on the canvas. Inbox and snoozed tasks never show;
// archived only in the archive view; done gated by its toggle.
export function visibleTasks(tasks: Task[], showDone: boolean, showArchived: boolean): Task[] {
  const now = Date.now();
  return tasks.filter(
    (t) =>
      !t.inbox &&
      !(t.snoozedUntil && Date.parse(t.snoozedUntil) > now) &&
      (t.archivedAt ? showArchived : showDone || !t.done),
  );
}

export function matchesSearch(task: Task, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    task.title.toLowerCase().includes(q) ||
    task.description.toLowerCase().includes(q) ||
    task.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

/** Best server bubble for a member set: most overlap, minimum 2 shared. */
export function bestBubbleMatch(bubbles: Bubble[], memberIds: string[]): Bubble | null {
  const set = new Set(memberIds);
  let best: Bubble | null = null;
  let bestScore = 1;
  for (const bubble of bubbles) {
    const score = bubble.memberIds.filter((m) => set.has(m)).length;
    if (score > bestScore) {
      best = bubble;
      bestScore = score;
    }
  }
  return best;
}
