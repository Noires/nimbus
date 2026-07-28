import { describe, expect, it } from "vitest";
import type { Task, Workstream } from "../store";
import { resolveSelectionContext } from "./selectionContext";

const task = { id: "task-1", title: "Ship inspector" } as Task;
const workstream = {
  id: "ws-1",
  name: "Release readiness",
  memberships: [{ taskId: "task-1" }],
} as Workstream;

describe("resolveSelectionContext", () => {
  it("inspects the single selected task ahead of the directory", () => {
    expect(resolveSelectionContext({
      selectedIds: [task.id],
      tasks: [task],
      selectedWorkstreamId: null,
      workstreams: [workstream],
    })).toEqual({ kind: "task", task });
  });

  it("inspects a workstream selected from the directory", () => {
    expect(resolveSelectionContext({
      selectedIds: [],
      tasks: [task],
      selectedWorkstreamId: workstream.id,
      workstreams: [workstream],
    })).toEqual({ kind: "workstream", workstream });
  });

  it("falls back to the directory for an ambiguous or stale selection", () => {
    expect(resolveSelectionContext({
      selectedIds: [task.id, "task-2"],
      tasks: [task],
      selectedWorkstreamId: "missing",
      workstreams: [workstream],
    })).toEqual({ kind: "directory" });
  });

  it("keeps the directory visible during focus mode", () => {
    expect(resolveSelectionContext({
      selectedIds: [task.id],
      tasks: [task],
      selectedWorkstreamId: workstream.id,
      workstreams: [workstream],
      focusActive: true,
    })).toEqual({ kind: "directory" });
  });
});
