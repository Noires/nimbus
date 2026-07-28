import { describe, expect, it } from "vitest";
import type { Dependency, Task } from "./api";
import { REVIEW_COMPLETED_DAYS, REVIEW_DUE_SOON_DAYS, REVIEW_STALE_DAYS, selectReviewQueues } from "./reviewSelectors";

function task(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  const { id, title, ...rest } = overrides;
  return {
    id,
    canvasId: "canvas-1",
    x: 0,
    y: 0,
    z: 0,
    title,
    description: "",
    tags: [],
    color: "#6366f1",
    dueDate: null,
    priority: "medium",
    done: false,
    archivedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    inbox: false,
    snoozedUntil: null,
    estimateMinutes: null,
    recurrence: null,
    lastActivityAt: "2026-07-28T12:00:00.000Z",
    actualMinutes: 0,
    provider: null,
    connectionId: null,
    externalKey: null,
    externalUrl: null,
    status: null,
    externalMeta: null,
    syncedAt: null,
    checklist: [],
    ...rest,
  };
}

const dependency = (blockerId: string, blockedId: string): Dependency => ({
  id: `${blockerId}-${blockedId}`,
  blockerId,
  blockedId,
});

const now = new Date("2026-07-28T12:00:00.000Z");

describe("selectReviewQueues", () => {
  it("derives mutually exclusive weekly queues from current task and dependency state", () => {
    const result = selectReviewQueues({
      tasks: [
        task({ id: "overdue", title: "Past due", dueDate: "2026-07-27T09:00:00.000Z" }),
        task({ id: "soon", title: "This week", dueDate: "2026-08-04T09:00:00.000Z" }),
        task({ id: "later", title: "Later", dueDate: "2026-08-05T09:00:00.000Z", lastActivityAt: "2026-07-14T11:00:00.000Z" }),
        task({ id: "blocked", title: "Wait for approval" }),
        task({ id: "blocker", title: "Approve" }),
        task({ id: "stale", title: "Untouched", lastActivityAt: "2026-07-14T11:59:59.000Z" }),
        task({ id: "inbox", title: "Captured", inbox: true }),
        task({ id: "snoozed", title: "Wake later", inbox: true, snoozedUntil: "2026-07-29T00:00:00.000Z" }),
        task({ id: "completed", title: "Finished", done: true, lastActivityAt: "2026-07-27T12:00:00.000Z" }),
        task({ id: "old-completed", title: "Old finish", done: true, lastActivityAt: "2026-07-20T12:00:00.000Z" }),
        task({ id: "archived", title: "Archived", archivedAt: "2026-07-28T00:00:00.000Z" }),
      ],
      dependencies: [dependency("blocker", "blocked")],
      now,
    });

    expect(result.overdue.map((candidate) => candidate.id)).toEqual(["overdue"]);
    expect(result.dueSoon.map((candidate) => candidate.id)).toEqual(["soon"]);
    expect(result.blocked.map((candidate) => candidate.id)).toEqual(["blocked"]);
    expect(result.stale.map((candidate) => candidate.id)).toEqual(["later", "stale"]);
    expect(result.inbox.map((candidate) => candidate.id)).toEqual(["inbox"]);
    expect(result.recentlyCompleted.map((candidate) => candidate.id)).toEqual(["completed"]);
  });

  it("documents stable operating windows for due-soon, stale, and recent completion queues", () => {
    expect(REVIEW_DUE_SOON_DAYS).toBe(7);
    expect(REVIEW_STALE_DAYS).toBe(14);
    expect(REVIEW_COMPLETED_DAYS).toBe(7);
  });

  it("includes the exact 14-day stale threshold", () => {
    const result = selectReviewQueues({
      tasks: [
        task({ id: "at-threshold", title: "At threshold", lastActivityAt: "2026-07-14T12:00:00.000Z" }),
        task({ id: "newer", title: "Newer", lastActivityAt: "2026-07-14T12:00:00.001Z" }),
      ],
      dependencies: [],
      now,
    });

    expect(result.stale.map((candidate) => candidate.id)).toEqual(["at-threshold"]);
  });

  it("uses local calendar days to exclude the eighth due-soon day across a DST transition", () => {
    // Build these as local civil times so the assertion verifies the host's
    // local-calendar window, regardless of the timezone that runs Vitest.
    const dstNow = new Date(2026, 2, 7, 23, 30);
    const result = selectReviewQueues({
      tasks: [
        task({ id: "seventh-day", title: "Seventh day", dueDate: new Date(2026, 2, 14, 12).toISOString() }),
        task({ id: "eighth-day", title: "Eighth day", dueDate: new Date(2026, 2, 15, 12).toISOString() }),
      ],
      dependencies: [],
      now: dstNow,
    });

    expect(result.dueSoon.map((candidate) => candidate.id)).toEqual(["seventh-day"]);
  });

  it("uses task IDs as deterministic final tie-breakers regardless of input order", () => {
    const tiedTasks = [
      task({ id: "task-b", title: "Same", dueDate: "2026-07-29T09:00:00.000Z", lastActivityAt: "2026-07-14T12:00:00.000Z" }),
      task({ id: "task-a", title: "Same", dueDate: "2026-07-29T09:00:00.000Z", lastActivityAt: "2026-07-14T12:00:00.000Z" }),
    ];

    const forward = selectReviewQueues({ tasks: tiedTasks, dependencies: [], now });
    const reversed = selectReviewQueues({ tasks: [...tiedTasks].reverse(), dependencies: [], now });

    expect(forward.dueSoon.map((candidate) => candidate.id)).toEqual(["task-a", "task-b"]);
    expect(reversed.dueSoon.map((candidate) => candidate.id)).toEqual(["task-a", "task-b"]);
  });
});
