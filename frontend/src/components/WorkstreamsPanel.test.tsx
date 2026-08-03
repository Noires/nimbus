import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import type { Dependency, Task } from "../data/api";
import { useLocale } from "../i18n";
import { WorkstreamArrangementPreview, WorkstreamsPanel } from "./WorkstreamsPanel";

const workstreams = [{
  id: "ws-1",
  canvasId: "canvas-1",
  name: "Release readiness",
  description: null,
  pinned: true,
  protected: true,
  memberships: [{ taskId: "task-1" }, { taskId: "task-2" }],
  createdAt: "2026-07-27T00:00:00.000Z",
  updatedAt: "2026-07-27T00:00:00.000Z",
}];

const tasks = [
  {
    id: "task-1", title: "Verify rollout", x: 0, y: 0, done: false, inbox: false,
    dueDate: "2026-07-27T00:00:00.000Z",
  },
  { id: "task-2", title: "Publish notes", x: 1, y: 1, done: true, inbox: false, dueDate: null },
] as Task[];

describe("WorkstreamsPanel", () => {
  afterEach(() => useLocale.setState({ locale: "en" }));

  it("labels durable workstreams separately from transient proximity suggestions", () => {
    const html = renderToStaticMarkup(
      <WorkstreamsPanel
        workstreams={workstreams}
        selectedId="ws-1"
        onSelect={() => {}}
        onCreate={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
        tasks={tasks}
        dependencies={[] as Dependency[]}
        now={new Date("2026-07-28T12:00:00.000Z")}
        onSetMembership={() => {}}
        onApplyArrangement={async () => false}
      />,
    );

    expect(html).toContain("Workstreams");
    expect(html).toContain("Durable, explicit task membership");
    expect(html).toContain("Suggested clusters are transient proximity hints");
    expect(html).toContain("Release readiness");
    expect(html).toContain("2 tasks");
    expect(html).toContain("At risk");
    expect(html).toContain("1 overdue · 1 of 2 complete");
    expect(html).toContain('data-workstream-health="at-risk"');
    expect(html).toContain("Pinned");
    expect(html).toContain("Protected");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Verify rollout");
    expect(html).toContain("Delete");
    expect(html).toContain('type="checkbox" role="switch" checked=""');
    expect(html).toContain("Protected — unprotect before deleting");
    expect(html).toContain('disabled=""');
  });

  it("renders a no-op preview with disabled Apply and a Cancel escape hatch", () => {
    const html = renderToStaticMarkup(
      <WorkstreamArrangementPreview
        preview={{
          strategy: "tidy-overlaps",
          scope: "workstream",
          moved: [],
          unchanged: ["task-1"],
          skipped: [],
          positions: [],
          inverse: [],
          isNoop: true,
          explanation: "No overlapping eligible cards need to move (1 checked).",
          explanations: [],
          revision: "current",
        }}
        onApply={async () => {}}
        onCancel={() => {}}
      />,
    );

    expect(html).toContain("No eligible overlapping cards need to move.");
    expect(html).toContain('disabled=""');
    expect(html).toContain("Apply");
    expect(html).toContain("Cancel");
  });

  it("localizes arrangement skip reasons instead of exposing internal reason identifiers", () => {
    useLocale.setState({ locale: "de" });
    const html = renderToStaticMarkup(
      <WorkstreamArrangementPreview
        preview={{ strategy: "tidy-overlaps", scope: "canvas", moved: [], unchanged: [], positions: [], inverse: [], isNoop: true, explanation: "", explanations: [], revision: "test", skipped: [{ id: "task-1", reason: "zone-too-small" }] }}
        onApply={async () => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(html).toContain("Ausgewählte Zone ist zu klein");
    expect(html).not.toContain("zone-too-small");
  });
});
