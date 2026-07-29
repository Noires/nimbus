import { describe, expect, it } from "vitest";
import type { Task, Workstream } from "./api";
import { selectOperationsWorkstreams } from "./operationsSelectors";

const task = (id: string, title: string, overrides: Partial<Task> = {}): Task => ({
  id,
  canvasId: "canvas-1",
  title,
  description: "",
  tags: [],
  color: "#000000",
  x: 0,
  y: 0,
  z: 0,
  dueDate: null,
  priority: "medium",
  done: false,
  archivedAt: null,
  createdAt: "2026-07-29T00:00:00.000Z",
  inbox: false,
  snoozedUntil: null,
  estimateMinutes: null,
  recurrence: null,
  lastActivityAt: "2026-07-29T00:00:00.000Z",
  actualMinutes: 0,
  provider: null,
  connectionId: null,
  externalKey: null,
  externalUrl: null,
  status: null,
  externalMeta: null,
  syncedAt: null,
  checklist: [],
  ...overrides,
});

const workstream = (id: string, name: string, taskIds: string[]): Workstream => ({
  id,
  canvasId: "canvas-1",
  name,
  description: null,
  pinned: false,
  protected: false,
  memberships: taskIds.map((taskId) => ({ taskId })),
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
});

describe("operations workstream selector", () => {
  it("excludes archived, done, and inbox tasks and puts Unassigned first", () => {
    const tasks = [
      task("task-2", "Second task"),
      task("task-1", "First task"),
      task("task-archived", "Archived task", { archivedAt: "2026-07-30T00:00:00.000Z" }),
      task("task-done", "Done task", { done: true }),
      task("task-inbox", "Inbox task", { inbox: true }),
    ];
    const workstreams = [
      workstream("ws-z", "Zebra", ["task-1", "task-1"]),
      workstream("ws-a", "Alpha", ["task-1", "task-archived", "task-done", "task-inbox"]),
    ];

    expect(selectOperationsWorkstreams({ tasks, workstreams })).toEqual([
      { id: "unassigned", name: "Unassigned", tasks: [tasks[0]] },
      { id: "ws-a", name: "Alpha", tasks: [tasks[1]] },
    ]);
  });

  it("breaks equally named workstreams by id, regardless of input order", () => {
    const tasks = [task("task-1", "First task")];
    const alphaA = workstream("ws-a", "Alpha", ["task-1"]);
    const alphaB = workstream("ws-b", "Alpha", ["task-1"]);

    expect(selectOperationsWorkstreams({ tasks, workstreams: [alphaB, alphaA] })).toEqual([
      { id: "ws-a", name: "Alpha", tasks },
    ]);
  });
});
