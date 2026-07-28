import { describe, expect, it } from "vitest";
import type { Dependency, Task, Workstream } from "./api";
import { selectWorkstreamHealth } from "./workstreamHealthSelectors";

const now = new Date("2026-07-28T12:00:00.000Z");

function task(id: string, patch: Partial<Task> = {}): Task {
  return {
    id,
    canvasId: "canvas-1",
    x: 0,
    y: 0,
    z: 0,
    title: id,
    description: "",
    tags: [],
    color: "blue",
    dueDate: null,
    priority: "medium",
    done: false,
    archivedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
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
    ...patch,
  };
}

function workstream(taskIds: string[]): Workstream {
  return {
    id: "ws-1",
    canvasId: "canvas-1",
    name: "Release",
    description: null,
    pinned: false,
    protected: false,
    memberships: taskIds.map((taskId) => ({ taskId })),
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

describe("selectWorkstreamHealth", () => {
  it("marks a non-empty workstream complete when every present member is done", () => {
    const health = selectWorkstreamHealth({
      workstream: workstream(["done-b", "done-a"]),
      tasks: [task("done-b", { done: true }), task("done-a", { done: true })],
      dependencies: [],
      now,
    });

    expect(health.status).toBe("complete");
    expect(health.primaryReason).toBe("all-complete");
    expect(health.completedCount).toBe(2);
    expect(health.taskIds).toEqual(["done-a", "done-b"]);
  });

  it("uses documented precedence: blocked before at-risk and triage", () => {
    const health = selectWorkstreamHealth({
      workstream: workstream(["blocked", "overdue", "inbox"]),
      tasks: [
        task("blocker"),
        task("blocked"),
        task("overdue", { dueDate: "2026-07-27T00:00:00.000Z" }),
        task("inbox", { inbox: true }),
      ],
      dependencies: [{ id: "dep-1", blockerId: "blocker", blockedId: "blocked" }] as Dependency[],
      now,
    });

    expect(health.status).toBe("blocked");
    expect(health.primaryReason).toBe("open-blockers");
    expect(health.blockedCount).toBe(1);
    expect(health.overdueCount).toBe(1);
    expect(health.inboxCount).toBe(1);
    expect(health.attentionTaskIds).toEqual(["blocked"]);
  });

  it("does not mark a task due on the current local calendar day as overdue", () => {
    const dueToday = new Date(now);
    dueToday.setHours(0, 0, 0, 0);
    const health = selectWorkstreamHealth({
      workstream: workstream(["due-today"]),
      tasks: [task("due-today", { dueDate: dueToday.toISOString() })],
      dependencies: [],
      now,
    });

    expect(health).toMatchObject({
      status: "on-track",
      primaryReason: "no-attention-signals",
      overdueCount: 0,
    });
  });

  it("classifies remaining risk, triage, and on-track states deterministically", () => {
    expect(selectWorkstreamHealth({
      workstream: workstream(["overdue"]),
      tasks: [task("overdue", { dueDate: "2026-07-27T00:00:00.000Z" })],
      dependencies: [],
      now,
    }).status).toBe("at-risk");

    expect(selectWorkstreamHealth({
      workstream: workstream(["inbox"]),
      tasks: [task("inbox", { inbox: true })],
      dependencies: [],
      now,
    }).status).toBe("needs-triage");

    expect(selectWorkstreamHealth({
      workstream: workstream(["b", "a"]),
      tasks: [task("b", { title: "Same" }), task("a", { title: "Same" })],
      dependencies: [],
      now,
    })).toMatchObject({
      status: "on-track",
      primaryReason: "no-attention-signals",
      taskIds: ["a", "b"],
      attentionTaskIds: [],
    });
  });

  it("sends empty and missing memberships to triage without inventing task state", () => {
    const empty = selectWorkstreamHealth({ workstream: workstream([]), tasks: [], dependencies: [], now });
    const missing = selectWorkstreamHealth({ workstream: workstream(["gone"]), tasks: [], dependencies: [], now });

    expect(empty).toMatchObject({ status: "needs-triage", primaryReason: "no-members", memberCount: 0 });
    expect(missing).toMatchObject({ status: "needs-triage", primaryReason: "missing-members", missingCount: 1 });
  });
});
