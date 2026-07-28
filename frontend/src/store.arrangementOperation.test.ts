import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskSchema } from "./data/api";
import { arrangementRevision, previewArrangementOperation } from "./engine/arrangementOperation";
import { history } from "./engine/history";
import { useStore } from "./store";

function task(id: string, x: number, y: number) {
  return TaskSchema.parse({
    id,
    canvasId: "canvas-1",
    x,
    y,
    z: 0,
    title: id,
    description: "",
    tags: [],
    color: "blue",
    dueDate: null,
    priority: "medium",
    done: false,
    archivedAt: null,
    createdAt: "2026-07-28T00:00:00.000Z",
    inbox: false,
    snoozedUntil: null,
    estimateMinutes: null,
    recurrence: null,
    lastActivityAt: "2026-07-28T00:00:00.000Z",
    checklist: [],
  });
}

describe("applyArrangementPreview", () => {
  beforeEach(() => {
    history.clear();
    useStore.setState({ tasks: [task("a", 0, 0), task("b", 0, 0), task("c", 0, 0)] });
  });

  afterEach(() => {
    history.clear();
    vi.unstubAllGlobals();
  });

  function previewForCurrentWorkstream() {
    const state = useStore.getState();
    return previewArrangementOperation({
      scope: { kind: "workstream", workstreamId: "ws-1", taskIds: ["a", "b", "c"] },
      tasks: state.tasks,
      workstreams: [{ id: "ws-1", pinned: false, protected: false, taskIds: ["a", "b", "c"] }],
      revision: arrangementRevision(state.tasks, state.workstreams),
    });
  }

  it("persists all preview positions through one bulk request and creates one undoable batch only after success", async () => {
    const fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const patch = JSON.parse(String(init?.body));
      const id = url.replace("/api/tasks/", "");
      const tasks = url === "/api/tasks/positions"
        ? patch.positions.map((position: { id: string; x: number; y: number }) => ({
          ...useStore.getState().tasks.find((item) => item.id === position.id)!,
          ...position,
        }))
        : [{ ...useStore.getState().tasks.find((item) => item.id === id)!, ...patch }];
      expect(init?.method).toBe(url === "/api/tasks/positions" ? "POST" : "PATCH");
      return new Response(JSON.stringify(url === "/api/tasks/positions" ? { tasks } : tasks[0]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetch);
    const before = useStore.getState().tasks.map(({ id, x, y }) => ({ id, x, y }));
    const preview = previewForCurrentWorkstream();

    await expect(useStore.getState().applyArrangementPreview(preview)).resolves.toBe(true);

    expect(preview.moved).toHaveLength(2);
    expect(preview.positions.map((position) => position.id)).toEqual(["b", "c"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(useStore.getState().tasks.map(({ id, x, y }) => ({ id, x, y }))).not.toEqual(before);

    await useStore.getState().undo();

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(taskPositionsInIdOrder(useStore.getState().tasks)).toEqual(taskPositionsInIdOrder(before));
    await useStore.getState().undo();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("does nothing for a cancelled or no-op preview", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const before = useStore.getState().tasks.map(({ id, x, y }) => ({ id, x, y }));
    const preview = previewArrangementOperation({
      scope: { kind: "workstream", workstreamId: "ws-1", taskIds: ["a"] },
      tasks: useStore.getState().tasks,
      workstreams: [{ id: "ws-1", pinned: false, protected: false, taskIds: ["a"] }],
    });

    // Cancelling discards the preview; applying a no-op must be equally inert.
    await useStore.getState().applyArrangementPreview(preview);

    expect(preview.isNoop).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(useStore.getState().tasks.map(({ id, x, y }) => ({ id, x, y }))).toEqual(before);
    expect(history.canUndo).toBe(false);
  });

  it("rejects a stale preview after a remote position or protection change without calling the bulk endpoint", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const preview = previewForCurrentWorkstream();

    useStore.getState().applyRemote({ entity: "task", action: "upsert", data: task("b", 75, 20) });

    await expect(useStore.getState().applyArrangementPreview(preview)).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(history.canUndo).toBe(false);
    expect(useStore.getState().toast?.message).toBe("Arrangement preview is out of date. Create a new preview.");

    const protectedPreview = previewForCurrentWorkstream();
    useStore.getState().applyRemote({
      entity: "workstream",
      action: "upsert",
      data: {
        id: "ws-1", canvasId: "canvas-1", name: "Protected", description: null,
        pinned: true, protected: false, memberships: [{ taskId: "a" }, { taskId: "b" }, { taskId: "c" }],
        createdAt: "2026-07-28T00:00:00.000Z", updatedAt: "2026-07-28T00:00:00.000Z",
      },
    });

    await expect(useStore.getState().applyArrangementPreview(protectedPreview)).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(history.canUndo).toBe(false);
  });

  it("keeps local positions and undo history unchanged when the bulk endpoint fails", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("database unavailable", { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    const before = taskPositionsInIdOrder(useStore.getState().tasks);

    await expect(useStore.getState().applyArrangementPreview(previewForCurrentWorkstream())).resolves.toBe(false);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(taskPositionsInIdOrder(useStore.getState().tasks)).toEqual(before);
    expect(history.canUndo).toBe(false);
    expect(useStore.getState().toast?.message).toBe("Could not apply arrangement. Your preview is still available.");
  });
});

function taskPositionsInIdOrder(tasks: Array<{ id: string; x: number; y: number }>) {
  return tasks
    .map(({ id, x, y }) => ({ id, x, y }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
