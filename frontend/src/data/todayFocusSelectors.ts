import type { Dependency, Task } from "./api";
import { localDayKey } from "../utils/capacity";

export interface TodayFocusSections {
  ready: Task[];
  due: Task[];
  blocked: Task[];
  recentlyCompleted: Task[];
}

interface TodayFocusInput {
  tasks: Task[];
  dependencies: Dependency[];
  now?: Date;
  limit?: number;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function priorityRank(task: Task): number {
  return PRIORITY_RANK[task.priority] ?? 3;
}

function compareOpenTasks(a: Task, b: Task): number {
  const priority = priorityRank(a) - priorityRank(b);
  if (priority !== 0) return priority;
  return a.title.localeCompare(b.title);
}

function compareDueTasks(a: Task, b: Task): number {
  const due = Date.parse(a.dueDate!) - Date.parse(b.dueDate!);
  if (due !== 0) return due;
  return compareOpenTasks(a, b);
}

function isActive(task: Task, now: Date): boolean {
  return !task.done && !task.inbox && !task.archivedAt && !(task.snoozedUntil && Date.parse(task.snoozedUntil) > now.getTime());
}

/**
 * Derives a bounded execution queue from existing client state. A task is
 * blocked when one of its known blockers remains open, matching the store's
 * unblocking behavior. Active sections are deliberately mutually exclusive.
 */
export function selectTodayFocus({ tasks, dependencies, now = new Date(), limit = 8 }: TodayFocusInput): TodayFocusSections {
  const active = tasks.filter((task) => isActive(task, now));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const blockedIds = new Set(
    dependencies
      .filter((dependency) => taskById.get(dependency.blockerId)?.done === false)
      .map((dependency) => dependency.blockedId),
  );
  const today = localDayKey(now);
  const due = active
    .filter((task) => !blockedIds.has(task.id) && task.dueDate && localDayKey(task.dueDate) <= today)
    .sort(compareDueTasks)
    .slice(0, limit);
  const ready = active
    .filter((task) => !blockedIds.has(task.id) && (!task.dueDate || localDayKey(task.dueDate) > today))
    .sort(compareOpenTasks)
    .slice(0, limit);
  const blocked = active
    .filter((task) => blockedIds.has(task.id))
    .sort(compareOpenTasks)
    .slice(0, limit);
  const recentlyCompleted = tasks
    .filter((task) => task.done && !task.inbox && !task.archivedAt)
    .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt) || a.title.localeCompare(b.title))
    .slice(0, limit);

  return { ready, due, blocked, recentlyCompleted };
}
