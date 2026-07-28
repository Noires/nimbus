import { describe, expect, it } from "vitest";
import type { Dependency, Task } from "./api";
import { selectTodayFocus } from "./todayFocusSelectors";

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
    createdAt: "2026-07-27T00:00:00.000Z",
    inbox: false,
    snoozedUntil: null,
    estimateMinutes: null,
    recurrence: null,
    lastActivityAt: "2026-07-27T00:00:00.000Z",
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

describe("selectTodayFocus", () => {
  it("derives mutually exclusive active sections from task and dependency state", () => {
    const result = selectTodayFocus({
      tasks: [
        task({ id: "overdue", title: "Fix outage", dueDate: "2026-07-27T09:00:00.000Z", priority: "high" }),
        task({ id: "today", title: "Send brief", dueDate: "2026-07-28T20:00:00.000Z" }),
        task({ id: "ready", title: "Plan next sprint", priority: "high" }),
        task({ id: "blocked", title: "Publish release", dueDate: "2026-07-28T09:00:00.000Z" }),
        task({ id: "blocker", title: "Wait for review" }),
        task({ id: "inbox", title: "Captured", inbox: true }),
        task({ id: "archived", title: "Old work", archivedAt: "2026-07-27T00:00:00.000Z" }),
        task({ id: "snoozed", title: "Not awake", snoozedUntil: "2026-07-29T00:00:00.000Z" }),
      ],
      dependencies: [dependency("blocker", "blocked")],
      now,
    });

    expect(result.due.map((candidate) => candidate.id)).toEqual(["overdue", "today"]);
    expect(result.ready.map((candidate) => candidate.id)).toEqual(["ready", "blocker"]);
    expect(result.blocked.map((candidate) => candidate.id)).toEqual(["blocked"]);
    expect(result.recentlyCompleted).toEqual([]);
  });

  it("sorts recently completed work by activity and excludes Inbox and archived tasks", () => {
    const result = selectTodayFocus({
      tasks: [
        task({ id: "older", title: "Older", done: true, lastActivityAt: "2026-07-27T08:00:00.000Z" }),
        task({ id: "newer", title: "Newer", done: true, lastActivityAt: "2026-07-28T08:00:00.000Z" }),
        task({ id: "inbox-done", title: "Captured", done: true, inbox: true }),
        task({ id: "archived-done", title: "Archived", done: true, archivedAt: "2026-07-28T08:00:00.000Z" }),
      ],
      dependencies: [],
      now,
    });

    expect(result.recentlyCompleted.map((candidate) => candidate.id)).toEqual(["newer", "older"]);
  });

  it("bounds every section without changing the deterministic order", () => {
    const result = selectTodayFocus({
      tasks: [
        task({ id: "low", title: "Low", priority: "low" }),
        task({ id: "high", title: "High", priority: "high" }),
        task({ id: "medium", title: "Medium", priority: "medium" }),
      ],
      dependencies: [],
      now,
      limit: 2,
    });

    expect(result.ready.map((candidate) => candidate.id)).toEqual(["high", "medium"]);
  });
});
