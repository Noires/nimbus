import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Dependency, Task, Workstream } from "../store";
import { InspectorRail } from "./InspectorRail";

const task = { id: "task-1", title: "Ship inspector", checklist: [], tags: [], done: false, description: "", priority: "medium", dueDate: null, status: null, lastActivityAt: "2026-07-28T00:00:00.000Z", provider: null } as unknown as Task;
const workstream = { id: "ws-1", name: "Release", memberships: [{ taskId: task.id }], pinned: false, protected: false } as Workstream;
const dependencies: Dependency[] = [];

describe("InspectorRail", () => {
  it("replaces the directory with the task inspector for a selected task", () => {
    const html = renderToStaticMarkup(
      <InspectorRail
        context={{ kind: "task", task }}
        directory={<p>Workstreams directory</p>}
        tasks={[task]}
        workstreams={[workstream]}
        dependencies={dependencies}
        onBack={() => {}}
        onOpenTask={() => {}}
        onOpenToday={() => {}}
        onOpenReview={() => {}}
      />,
    );

    expect(html).toContain('data-selection-context="task"');
    expect(html).toContain("Task inspector");
    expect(html).not.toContain("Workstreams directory");
  });

  it("preserves the directory when selection has no inspectable object", () => {
    const html = renderToStaticMarkup(
      <InspectorRail
        context={{ kind: "directory" }}
        directory={<p>Workstreams directory</p>}
        tasks={[task]}
        workstreams={[workstream]}
        dependencies={dependencies}
        onBack={() => {}}
        onOpenTask={() => {}}
        onOpenToday={() => {}}
        onOpenReview={() => {}}
      />,
    );

    expect(html).toContain('data-selection-context="directory"');
    expect(html).toContain("Workstreams directory");
    expect(html).not.toContain("Task inspector");
  });
});
