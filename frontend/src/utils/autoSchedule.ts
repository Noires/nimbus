import type { Dependency, Task } from "../store";
import { DEFAULT_ESTIMATE_MINUTES, dailyCapacityMinutes, localDayKey } from "./capacity";

interface AutoScheduleOptions {
  skipWeekends?: boolean;
  dailyMinutes?: number;
  /** Minutes already committed per day by tasks outside this fill. */
  baseLoad?: Map<string, number>;
}

// Distribute tasks across coming days: never overbook daily capacity, never
// schedule a blocked task before its blocker. Returns taskId → due ISO.
export function autoSchedule(
  tasks: Task[],
  allDependencies: Dependency[],
  opts: AutoScheduleOptions = {},
): Map<string, string> {
  const daily = opts.dailyMinutes ?? dailyCapacityMinutes();
  const skipWeekends = opts.skipWeekends ?? true;
  const ids = new Set(tasks.map((t) => t.id));
  const deps = allDependencies.filter((d) => ids.has(d.blockerId) && ids.has(d.blockedId));

  // Topological order (Kahn), priority then title as tiebreakers.
  const prioRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const indegree = new Map(tasks.map((t) => [t.id, 0]));
  const out = new Map<string, string[]>();
  for (const d of deps) {
    indegree.set(d.blockedId, (indegree.get(d.blockedId) ?? 0) + 1);
    const list = out.get(d.blockerId);
    if (list) list.push(d.blockedId);
    else out.set(d.blockerId, [d.blockedId]);
  }
  const ready = tasks.filter((t) => (indegree.get(t.id) ?? 0) === 0);
  const byUrgency = (a: Task, b: Task) =>
    (prioRank[a.priority] ?? 3) - (prioRank[b.priority] ?? 3) || a.title.localeCompare(b.title);
  ready.sort(byUrgency);

  const order: Task[] = [];
  while (ready.length) {
    const task = ready.shift()!;
    order.push(task);
    for (const next of out.get(task.id) ?? []) {
      const deg = (indegree.get(next) ?? 1) - 1;
      indegree.set(next, deg);
      if (deg === 0) {
        ready.push(byId.get(next)!);
        ready.sort(byUrgency);
      }
    }
  }
  // Cycles can't exist (server rejects them), but stay safe:
  if (order.length < tasks.length) {
    for (const t of tasks) if (!order.includes(t)) order.push(t);
  }

  const used = new Map(opts.baseLoad ?? []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextWorkday = (d: Date): Date => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + 1);
    while (skipWeekends && (copy.getDay() === 0 || copy.getDay() === 6)) {
      copy.setDate(copy.getDate() + 1);
    }
    return copy;
  };

  const startDay = skipWeekends && (today.getDay() === 0 || today.getDay() === 6)
    ? nextWorkday(today)
    : today;

  const assignedDay = new Map<string, number>(); // taskId → epoch of its day
  const plan = new Map<string, string>();

  for (const task of order) {
    const need = task.estimateMinutes ?? DEFAULT_ESTIMATE_MINUTES;
    // Never earlier than any blocker's day.
    const blockerDays = deps
      .filter((d) => d.blockedId === task.id)
      .map((d) => assignedDay.get(d.blockerId) ?? startDay.getTime());
    let day = new Date(Math.max(startDay.getTime(), ...(blockerDays.length ? blockerDays : [startDay.getTime()])));
    for (let guard = 0; guard < 365; guard++) {
      const key = localDayKey(day);
      if ((used.get(key) ?? 0) + need <= daily) break;
      day = nextWorkday(day);
    }
    const key = localDayKey(day);
    used.set(key, (used.get(key) ?? 0) + need);
    assignedDay.set(task.id, day.getTime());
    plan.set(task.id, day.toISOString());
  }

  return plan;
}
