import type { Task } from "../store";

// Weekly-review triage order: overdue first (most overdue leading), then
// stale (untouched 14+ days, oldest first), then undated.
export function buildReviewQueue(tasks: Task[]): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = Date.now();

  const candidates = tasks.filter(
    (t) =>
      !t.done &&
      !t.archivedAt &&
      !t.inbox &&
      !(t.snoozedUntil && Date.parse(t.snoozedUntil) > now),
  );

  const overdue = candidates
    .filter((t) => t.dueDate && Date.parse(t.dueDate) < today.getTime())
    .sort((a, b) => Date.parse(a.dueDate!) - Date.parse(b.dueDate!));

  const STALE_MS = 14 * 86_400_000;
  const stale = candidates
    .filter((t) => !overdue.includes(t) && now - Date.parse(t.lastActivityAt) > STALE_MS)
    .sort((a, b) => Date.parse(a.lastActivityAt) - Date.parse(b.lastActivityAt));

  const undated = candidates.filter(
    (t) => !t.dueDate && !overdue.includes(t) && !stale.includes(t),
  );

  return [...overdue, ...stale, ...undated].map((t) => t.id);
}
