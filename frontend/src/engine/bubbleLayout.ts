export interface WorldPoint {
  x: number;
  y: number;
}

export const DEFAULT_CARD_WIDTH = 256;
export const DEFAULT_CARD_HEIGHT = 170;
export const COLLISION_PADDING = 8;
export const LATTICE_X_SPACING = 130;
export const LATTICE_Y_SPACING = 185;

export interface LayoutTask {
  id: string;
  x: number;
  y: number;
  tags: readonly string[];
  status: string | null;
  priority: string | null;
  dueDate: string | null;
}

export interface LayoutCandidateOptions {
  pinnedBubbleMemberIds?: readonly ReadonlySet<string>[];
  includePinnedBubbles?: boolean;
}

export interface WorldRect extends WorldPoint {
  width: number;
  height: number;
}

export function selectLayoutCandidates(
  tasks: readonly LayoutTask[],
  options: LayoutCandidateOptions = {},
): LayoutTask[] {
  if (options.includePinnedBubbles) return [...tasks];

  const pinnedTaskIds = new Set(options.pinnedBubbleMemberIds?.flatMap((memberIds) => [...memberIds]));
  return tasks.filter((task) => !pinnedTaskIds.has(task.id));
}

export function rectanglesOverlap(
  left: WorldRect,
  right: WorldRect,
  padding = COLLISION_PADDING,
): boolean {
  return left.x < right.x + right.width + padding
    && left.x + left.width + padding > right.x
    && left.y < right.y + right.height + padding
    && left.y + left.height + padding > right.y;
}

export type ArrangeMode = "tag" | "status" | "priority" | "dueDate" | "lattice";

export type ArrangeRequest =
  | { mode: "tag" }
  | { mode: "status"; statusOrder: readonly string[] }
  | { mode: "priority"; priorityOrder: readonly string[] }
  | { mode: "dueDate"; dueDateContext: DueDateContext }
  | { mode: "lattice" };

export interface DueDateContext {
  now: Date | string | number;
  timeZone: string;
}

export type DueDateGroup =
  | "Overdue"
  | "Today"
  | "Tomorrow"
  | "This week"
  | "Later"
  | "No due date"
  | "Invalid due date";

export interface ArrangeGroup {
  key: string;
  taskIds: string[];
}

function compareDeterministicStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function createLatticePositions(origin: WorldPoint, count: number): WorldPoint[] {
  if (count <= 0) return [];

  const shells = Math.max(2, Math.ceil(Math.sqrt(count)) + 1);
  const cells: Array<{ x: number; y: number; distance: number; angle: number }> = [];
  for (let column = -2 * shells; column <= 2 * shells; column++) {
    for (let row = -shells; row <= shells; row++) {
      if ((column + row) % 2 !== 0) continue;
      const x = column * LATTICE_X_SPACING;
      const y = row * LATTICE_Y_SPACING;
      cells.push({ x, y, distance: Math.hypot(x, y), angle: Math.atan2(y, x) });
    }
  }

  return cells
    .sort((left, right) => left.distance - right.distance || left.angle - right.angle)
    .slice(0, count)
    .map((cell) => ({ x: origin.x + cell.x, y: origin.y + cell.y }));
}

function calendarDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)) / 86_400_000;
}

function isValidIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return parsed.getUTCFullYear() === Number(year)
    && parsed.getUTCMonth() === Number(month) - 1
    && parsed.getUTCDate() === Number(day);
}

export function classifyDueDate(dueDate: string | null, context: DueDateContext): DueDateGroup {
  if (dueDate === null || dueDate.trim() === "") return "No due date";

  const dueAt = new Date(dueDate);
  const now = context.now instanceof Date ? new Date(context.now) : new Date(context.now);
  if (!isValidIsoCalendarDate(dueDate) || Number.isNaN(dueAt.getTime()) || Number.isNaN(now.getTime())) {
    return "Invalid due date";
  }

  const dueDay = calendarDay(dueAt, context.timeZone);
  const today = calendarDay(now, context.timeZone);
  const difference = dueDay - today;
  if (difference < 0) return "Overdue";
  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";

  const dayOfWeek = new Date(today * 86_400_000).getUTCDay();
  const daysUntilSunday = (7 - dayOfWeek) % 7;
  return difference <= daysUntilSunday ? "This week" : "Later";
}

export function groupTasksForArrange(tasks: readonly LayoutTask[], request: ArrangeRequest): ArrangeGroup[] {
  const groups = new Map<string, LayoutTask[]>();
  for (const task of tasks) {
    const key = request.mode === "tag"
      ? task.tags[0] ?? "No tag"
      : request.mode === "status"
        ? task.status ?? "No status"
        : request.mode === "priority"
          ? task.priority ?? "No priority"
          : request.mode === "dueDate"
            ? classifyDueDate(task.dueDate, request.dueDateContext)
            : null;
    if (key === null) return [];
    const members = groups.get(key) ?? [];
    members.push(task);
    groups.set(key, members);
  }

  const requestedOrder = request.mode === "status"
    ? request.statusOrder
    : request.mode === "priority"
      ? request.priorityOrder
      : request.mode === "dueDate"
        ? ["Overdue", "Today", "Tomorrow", "This week", "Later", "No due date", "Invalid due date"]
        : [];
  const rank = (key: string) => requestedOrder.indexOf(key);
  const noneKey = request.mode === "tag"
    ? "No tag"
    : request.mode === "status"
      ? "No status"
      : request.mode === "priority"
        ? "No priority"
        : "No due date";
  return [...groups.entries()]
    .sort(([a], [b]) =>
      (request.mode === "dueDate" ? 0 : a === noneKey ? 1 : b === noneKey ? -1 : 0)
      || (rank(a) + 1 || Number.MAX_SAFE_INTEGER) - (rank(b) + 1 || Number.MAX_SAFE_INTEGER)
      || compareDeterministicStrings(a, b),
    )
    .map(([key, members]) => ({
      key,
      taskIds: members
        .sort((a, b) => compareDeterministicStrings(a.id, b.id))
        .map((task) => task.id),
    }));
}
