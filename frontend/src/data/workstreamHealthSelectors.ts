import type { Dependency, Task, Workstream } from "./api";
import { localDayKey } from "../utils/capacity";

export type WorkstreamHealthStatus = "complete" | "blocked" | "at-risk" | "needs-triage" | "on-track";
export type WorkstreamHealthReason =
  | "all-complete"
  | "open-blockers"
  | "overdue-members"
  | "inbox-members"
  | "no-members"
  | "missing-members"
  | "no-attention-signals";

export interface WorkstreamHealth {
  /** Stable semantic status; presentation is localized by the caller. */
  status: WorkstreamHealthStatus;
  /** Stable explanation code; presentation is localized by the caller. */
  primaryReason: WorkstreamHealthReason;
  memberCount: number;
  presentMemberCount: number;
  missingCount: number;
  completedCount: number;
  openCount: number;
  blockedCount: number;
  overdueCount: number;
  inboxCount: number;
  /** All known member IDs, sorted by ID for deterministic task subset links. */
  taskIds: string[];
  /** IDs behind the primary health reason, sorted by ID. */
  attentionTaskIds: string[];
}

interface WorkstreamHealthInput {
  workstream: Workstream;
  tasks: Task[];
  dependencies: Dependency[];
  now?: Date;
}

function sortedIds(ids: Iterable<string>): string[] {
  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
}

function isOverdue(task: Task, now: Date): boolean {
  return !task.done && task.dueDate !== null && localDayKey(task.dueDate) < localDayKey(now);
}

/**
 * Classifies explicit durable members only. Precedence is complete, blocked,
 * at-risk, needs-triage, then on-track: an all-complete workstream has no
 * actionable concern; otherwise an unresolved dependency outranks lateness,
 * which outranks inbox triage. Empty or missing memberships are triage.
 */
export function selectWorkstreamHealth({ workstream, tasks, dependencies, now = new Date() }: WorkstreamHealthInput): WorkstreamHealth {
  const memberIds = sortedIds(workstream.memberships.map((membership) => membership.taskId));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const members = memberIds.flatMap((id) => {
    const task = taskById.get(id);
    return task ? [task] : [];
  });
  const missingIds = memberIds.filter((id) => !taskById.has(id));
  const openMembers = members.filter((task) => !task.done);
  const blockedIds = new Set(
    dependencies
      .filter((dependency) => taskById.get(dependency.blockerId)?.done === false)
      .map((dependency) => dependency.blockedId),
  );
  const blocked = openMembers.filter((task) => blockedIds.has(task.id));
  const overdue = openMembers.filter((task) => isOverdue(task, now));
  const inbox = openMembers.filter((task) => task.inbox);
  const base = {
    memberCount: memberIds.length,
    presentMemberCount: members.length,
    missingCount: missingIds.length,
    completedCount: members.filter((task) => task.done).length,
    openCount: openMembers.length,
    blockedCount: blocked.length,
    overdueCount: overdue.length,
    inboxCount: inbox.length,
    taskIds: memberIds,
  };

  if (memberIds.length > 0 && missingIds.length === 0 && openMembers.length === 0) {
    return { ...base, status: "complete", primaryReason: "all-complete", attentionTaskIds: [] };
  }
  if (blocked.length > 0) {
    return { ...base, status: "blocked", primaryReason: "open-blockers", attentionTaskIds: sortedIds(blocked.map((task) => task.id)) };
  }
  if (overdue.length > 0) {
    return { ...base, status: "at-risk", primaryReason: "overdue-members", attentionTaskIds: sortedIds(overdue.map((task) => task.id)) };
  }
  if (inbox.length > 0) {
    return { ...base, status: "needs-triage", primaryReason: "inbox-members", attentionTaskIds: sortedIds(inbox.map((task) => task.id)) };
  }
  if (memberIds.length === 0) {
    return { ...base, status: "needs-triage", primaryReason: "no-members", attentionTaskIds: [] };
  }
  if (missingIds.length > 0) {
    return { ...base, status: "needs-triage", primaryReason: "missing-members", attentionTaskIds: missingIds };
  }
  return { ...base, status: "on-track", primaryReason: "no-attention-signals", attentionTaskIds: [] };
}
