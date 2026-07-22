import { CARD_W, CARD_H } from "../store";
import { latticePositions } from "./lattice";

export type ArrangeMode = "tag" | "status" | "priority" | "due";

/** Sentinel group key for tasks without a value for the chosen criterion.
 *  The caller maps it (and due buckets) to localized labels. */
export const NONE_KEY = "__none";

export interface ArrangeGroup {
  key: string;
  memberIds: string[];
}

interface TaskLike {
  id: string;
  x: number;
  y: number;
  title: string;
  tags: string[];
  priority: string;
  status: string | null;
  dueDate: string | null;
}

const DAY = 86_400_000;
const PRIO_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const DUE_ORDER: Record<string, number> = { overdue: 0, today: 1, week: 2, later: 3, [NONE_KEY]: 4 };

/** Edge gap between group bounding boxes; > 276px hysteresis so separated
 *  groups never merge into one bubble. */
const GROUP_GAP = 300;

function groupKey(task: TaskLike, mode: ArrangeMode, now: number): string {
  if (mode === "tag") return task.tags[0] ?? NONE_KEY;
  if (mode === "status") return task.status ?? NONE_KEY;
  if (mode === "priority") return PRIO_ORDER[task.priority] !== undefined ? task.priority : "medium";
  // due buckets
  if (!task.dueDate) return NONE_KEY;
  const days = Math.floor((Date.parse(task.dueDate) - now) / DAY);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

function groupOrder(key: string, mode: ArrangeMode): number {
  if (mode === "priority") return PRIO_ORDER[key] ?? 3;
  if (mode === "due") return DUE_ORDER[key] ?? 5;
  return key === NONE_KEY ? 1 : 0; // tag/status: alphabetical, "none" last
}

/** Group visible tasks by the chosen criterion and lay each group out on the
 *  overlap-free diamond lattice around a shelf-packed anchor. Deterministic.
 *  Returns the new positions plus group memberships for bubble titling. */
export function computeAutoArrange(
  tasks: TaskLike[],
  mode: ArrangeMode,
): { moves: Map<string, { x: number; y: number }>; groups: ArrangeGroup[] } {
  const moves = new Map<string, { x: number; y: number }>();
  if (tasks.length === 0) return { moves, groups: [] };
  const now = Date.now();

  const byKey = new Map<string, TaskLike[]>();
  for (const task of tasks) {
    const key = groupKey(task, mode, now);
    const list = byKey.get(key);
    if (list) list.push(task);
    else byKey.set(key, [task]);
  }

  const keys = [...byKey.keys()].sort(
    (a, b) => groupOrder(a, mode) - groupOrder(b, mode) || a.localeCompare(b),
  );

  const dueOf = (t: TaskLike) => (t.dueDate ? Date.parse(t.dueDate) : Number.MAX_SAFE_INTEGER);
  const prioOf = (t: TaskLike) => PRIO_ORDER[t.priority] ?? 3;

  // Per group: lattice positions relative to (0,0) and the EXACT card
  // bounding box they produce (positions are card top-left corners).
  const cells = keys.map((key) => {
    const sorted = [...byKey.get(key)!].sort(
      (a, b) => dueOf(a) - dueOf(b) || prioOf(a) - prioOf(b) || a.title.localeCompare(b.title),
    );
    const rel = latticePositions(0, 0, sorted.length);
    const minX = Math.min(...rel.map((p) => p.x));
    const maxX = Math.max(...rel.map((p) => p.x)) + CARD_W;
    const minY = Math.min(...rel.map((p) => p.y));
    const maxY = Math.max(...rel.map((p) => p.y)) + CARD_H;
    return {
      key,
      sorted,
      rel,
      halfW: (maxX - minX) / 2,
      halfH: (maxY - minY) / 2,
      // Offset from the box center back to the lattice origin.
      originX: -(minX + maxX) / 2,
      originY: -(minY + maxY) / 2,
    };
  });

  // Shelf layout: ~√n groups per row, rows sized by their tallest cell.
  const perRow = Math.max(1, Math.ceil(Math.sqrt(cells.length)));
  const anchors: Array<{ x: number; y: number }> = [];
  let y = 0;
  for (let row = 0; row * perRow < cells.length; row++) {
    const rowCells = cells.slice(row * perRow, (row + 1) * perRow);
    const rowHalfH = Math.max(...rowCells.map((c) => c.halfH));
    let x = 0;
    for (const cell of rowCells) {
      x += cell.halfW;
      anchors.push({ x, y: y + rowHalfH });
      x += cell.halfW + GROUP_GAP;
    }
    y += 2 * rowHalfH + GROUP_GAP;
  }

  // Keep the layout roughly where the content was: align bounding centers.
  const cx = tasks.reduce((s, t) => s + t.x, 0) / tasks.length;
  const cy = tasks.reduce((s, t) => s + t.y, 0) / tasks.length;
  const ax = anchors.reduce((s, a) => s + a.x, 0) / anchors.length;
  const ay = anchors.reduce((s, a) => s + a.y, 0) / anchors.length;
  const dx = cx - ax;
  const dy = cy - ay;

  const groups: ArrangeGroup[] = [];
  cells.forEach((cell, i) => {
    const ox = anchors[i].x + dx + cell.originX;
    const oy = anchors[i].y + dy + cell.originY;
    cell.sorted.forEach((task, j) => {
      const x = Math.round(ox + cell.rel[j].x);
      const yPos = Math.round(oy + cell.rel[j].y);
      if (x !== task.x || yPos !== task.y) moves.set(task.id, { x, y: yPos });
    });
    groups.push({ key: cell.key, memberIds: cell.sorted.map((t) => t.id) });
  });

  return { moves, groups };
}
