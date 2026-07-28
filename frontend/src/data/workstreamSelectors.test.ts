import { describe, expect, it } from "vitest";
import type { Workstream } from "./api";
import { workstreamTaskCount, workstreamsForTask } from "./workstreamSelectors";

const streams: Workstream[] = [
  {
    id: "ws-product",
    canvasId: "canvas-1",
    name: "Product launch",
    description: "Ship the new experience",
    pinned: true,
    protected: false,
    memberships: [{ taskId: "task-a" }, { taskId: "task-b" }],
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
  },
  {
    id: "ws-risk",
    canvasId: "canvas-1",
    name: "Risk review",
    description: null,
    pinned: false,
    protected: true,
    memberships: [{ taskId: "task-b" }],
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
  },
];

describe("workstream selectors", () => {
  it("counts only explicit durable memberships", () => {
    expect(workstreamTaskCount(streams[0])).toBe(2);
  });

  it("allows a task to belong to multiple workstreams", () => {
    expect(workstreamsForTask(streams, "task-b").map((stream) => stream.id)).toEqual([
      "ws-product",
      "ws-risk",
    ]);
  });
});
