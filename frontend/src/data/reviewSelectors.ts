import type { Dependency, Task } from "./api";
import { localDayKey } from "../utils/capacity";

export const REVIEW_DUE_SOON_DAYS = 7;
export const REVIEW_STALE_DAYS = 14;
export const REVIEW_COMPLETED_DAYS = 7;

export interface ReviewQueues {
  overdue: Task[];
  dueSoon: Task[];
  blocked: Task[];
  stale: Task[];
  inbox: Task[];
  recentlyCompleted: Task[];
}

interface ReviewQueueInput {
  tasks: Task[];
  dependencies: Dependency[];
  now?: Date;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const DAY_MS = 86_400_000;

function compareTaskId(a: Task, b: Task): number {
  return a.id.localeCompare(b.id);
}

function compareOpenTasks(a: Task, b: Task): number {
  const priority = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
  return priority || a.title.localeCompare(b.title) || compareTaskId(a, b);
}

function compareDueTasks(a: Task, b: Task): number {
  return Date.parse(a.dueDate!) - Date.parse(b.dueDate!) || compareOpenTasks(a, b);
}

function isActive(task: Task, now: Date): boolean {
  return !task.done && !task.inbox && !task.archivedAt && !(task.snoozedUntil && Date.parse(task.snoozedUntil) > now.getTime());
}

function addLocalCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Derives a weekly operating loop from current client state only. Due-soon is
 * today through local calendar day +7 (inclusive), stale means no activity for 14 days,
 * and recently completed means activity in the preceding seven days.
 */
export function selectReviewQueues({ tasks, dependencies, now = new Date() }: ReviewQueueInput): ReviewQueues {
  const active = tasks.filter((task) => isActive(task, now));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const blockedIds = new Set(
    dependencies
      .filter((dependency) => taskById.get(dependency.blockerId)?.done === false)
      .map((dependency) => dependency.blockedId),
  );
  const today = localDayKey(now);
  const dueSoonEnd = localDayKey(addLocalCalendarDays(now, REVIEW_DUE_SOON_DAYS));
  const eligible = active.filter((task) => !blockedIds.has(task.id));
  const overdue = eligible
    .filter((task) => task.dueDate && localDayKey(task.dueDate) < today)
    .sort(compareDueTasks);
  const dueSoon = eligible
    .filter((task) => task.dueDate && localDayKey(task.dueDate) >= today && localDayKey(task.dueDate) <= dueSoonEnd)
    .sort(compareDueTasks);
  const classified = new Set([...overdue, ...dueSoon].map((task) => task.id));
  const blocked = active
    .filter((task) => blockedIds.has(task.id))
    .sort(compareOpenTasks);
  blocked.forEach((task) => classified.add(task.id));
  const staleBefore = now.getTime() - REVIEW_STALE_DAYS * DAY_MS;
  const stale = active
    .filter((task) => !classified.has(task.id) && Date.parse(task.lastActivityAt) <= staleBefore)
    .sort((a, b) => Date.parse(a.lastActivityAt) - Date.parse(b.lastActivityAt) || compareOpenTasks(a, b));
  const inbox = tasks
    .filter((task) => task.inbox && !task.done && !task.archivedAt && !(task.snoozedUntil && Date.parse(task.snoozedUntil) > now.getTime()))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.title.localeCompare(b.title) || compareTaskId(a, b));
  const recentlyCompletedAfter = now.getTime() - REVIEW_COMPLETED_DAYS * DAY_MS;
  const recentlyCompleted = tasks
    .filter((task) => task.done && !task.inbox && !task.archivedAt && Date.parse(task.lastActivityAt) >= recentlyCompletedAfter)
    .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt) || a.title.localeCompare(b.title) || compareTaskId(a, b));

  return { overdue, dueSoon, blocked, stale, inbox, recentlyCompleted };
}