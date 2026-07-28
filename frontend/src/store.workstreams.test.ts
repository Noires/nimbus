import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskSchema } from "./data/api";
import { useStore } from "./store";

const task = TaskSchema.parse({
  id: "task-1",
  canvasId: "canvas-1",
  x: 0,
  y: 0,
  z: 0,
  title: "Ship workstreams",
  description: "",
  tags: [],
  color: "blue",
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
  checklist: [],
});

describe("remote task deletion", () => {
  beforeEach(() => {
    useStore.setState({
      tasks: [task],
      workstreams: [
        {
          id: "ws-1",
          canvasId: "canvas-1",
          name: "Release",
          description: null,
          pinned: false,
          protected: false,
          memberships: [{ taskId: "task-1" }, { taskId: "task-2" }],
          createdAt: "2026-07-27T00:00:00.000Z",
          updatedAt: "2026-07-27T00:00:00.000Z",
        },
        {
          id: "ws-2",
          canvasId: "canvas-1",
          name: "Launch",
          description: null,
          pinned: false,
          protected: false,
          memberships: [{ taskId: "task-1" }],
          createdAt: "2026-07-27T00:00:00.000Z",
          updatedAt: "2026-07-27T00:00:00.000Z",
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cleans local workstream memberships after a successful deletion when its own SSE echo is suppressed", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);

    await useStore.getState().deleteTask("task-1");

    expect(fetch).toHaveBeenCalledWith("/api/tasks/task-1", expect.objectContaining({ method: "DELETE" }));
    expect(useStore.getState().tasks).toEqual([]);
    expect(useStore.getState().workstreams.map((workstream) => workstream.memberships)).toEqual([
      [{ taskId: "task-2" }],
      [],
    ]);
  });

  it("removes the deleted task from every local workstream until SSE upserts arrive", () => {
    useStore.getState().applyRemote({ entity: "task", action: "delete", data: { id: "task-1" } });

    expect(useStore.getState().workstreams[0].memberships).toEqual([{ taskId: "task-2" }]);
  });
});