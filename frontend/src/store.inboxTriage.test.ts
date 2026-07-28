import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskSchema } from "./data/api";
import { history } from "./engine/history";
import { useStore } from "./store";

const inboxTask = TaskSchema.parse({
  id: "task-1",
  canvasId: "canvas-1",
  x: 0,
  y: 0,
  z: 0,
  title: "Triage customer feedback",
  description: "",
  tags: [],
  color: "blue",
  dueDate: null,
  priority: "medium",
  done: false,
  archivedAt: null,
  createdAt: "2026-07-28T00:00:00.000Z",
  inbox: true,
  snoozedUntil: null,
  estimateMinutes: null,
  recurrence: null,
  lastActivityAt: "2026-07-28T00:00:00.000Z",
  checklist: [],
});

const workstream = {
  id: "workstream-1",
  canvasId: "canvas-1",
  name: "Customer success",
  description: null,
  pinned: false,
  protected: false,
  memberships: [],
  createdAt: "2026-07-28T00:00:00.000Z",
  updatedAt: "2026-07-28T00:00:00.000Z",
};

const failedResponse = () => new Response("unavailable", { status: 503 });

describe("Inbox triage persistence failures", () => {
  beforeEach(() => {
    history.clear();
    useStore.setState({ tasks: [inboxTask], workstreams: [workstream] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failedResponse()));
  });

  afterEach(() => {
    history.clear();
    vi.unstubAllGlobals();
  });

  it.each([
    ["move out of Inbox", { inbox: false }],
    ["priority", { priority: "high" }],
    ["due date", { dueDate: "2026-08-01T00:00:00.000Z" }],
  ] as const)("keeps the Inbox task unchanged and adds no undo entry when %s fails", async (_action, patch) => {
    await expect(useStore.getState().patchTask(inboxTask.id, patch)).rejects.toThrow("PATCH /api/tasks/task-1 failed (503)");

    expect(useStore.getState().tasks).toEqual([inboxTask]);
    expect(history.canUndo).toBe(false);
  });

  it("keeps workstream membership unchanged when assignment fails", async () => {
    await expect(useStore.getState().setWorkstreamMembership(workstream.id, inboxTask.id, true)).rejects.toThrow("PUT /api/workstreams/workstream-1/tasks/task-1 failed (503)");

    expect(useStore.getState().workstreams).toEqual([workstream]);
    expect(history.canUndo).toBe(false);
  });
});
