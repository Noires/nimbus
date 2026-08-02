import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { useLocale } from "../i18n";
import type { Dependency, Task, Workstream } from "../store";
import { TaskInspector, WorkstreamInspector } from "./Inspector";

const task = {
  id: "task-1",
  title: "Ship inspector",
  description: "Confirm the rail uses selection context.",
  done: false,
  status: "In progress",
  dueDate: "2026-08-01T00:00:00.000Z",
  priority: "high",
  tags: ["frontend", "a11y"],
  checklist: [{ id: "check-1", taskId: "task-1", text: "Write tests", done: true, order: 0 }, { id: "check-2", taskId: "task-1", text: "Build", done: false, order: 1 }],
  provider: "github",
  externalKey: "#42",
  externalUrl: "https://example.test/issues/42",
  syncedAt: "2026-07-28T12:00:00.000Z",
  lastActivityAt: "2026-07-28T11:00:00.000Z",
} as Task;
const workstream = {
  id: "ws-1",
  name: "Release readiness",
  description: "Everything needed before launch.",
  pinned: true,
  protected: true,
  memberships: [{ taskId: task.id }],
} as Workstream;

describe("inspectors", () => {
  afterEach(() => useLocale.setState({ locale: "en" }));

  it("renders task state, planning metadata, relationships, sync, and an accessible return action", () => {
    const html = renderToStaticMarkup(
      <TaskInspector
        task={task}
        workstreams={[workstream]}
        dependencies={[
          { id: "dep-1", blockerId: "task-2", blockedId: task.id },
          { id: "dep-2", blockerId: task.id, blockedId: "task-3" },
        ] as Dependency[]}
        tasks={[task, { ...task, id: "task-2", title: "Approve design" }, { ...task, id: "task-3", title: "Publish" }]}
        onBack={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Inspector"');
    expect(html).toContain("Ship inspector");
    expect(html).toContain("In progress");
    expect(html).toContain("Confirm the rail uses selection context.");
    expect(html).toContain("Release readiness");
    expect(html).toContain("Aug 1, 2026");
    expect(html).toContain("High");
    expect(html).toContain("frontend");
    expect(html).toContain("1 of 2");
    expect(html).toContain("Approve design");
    expect(html).toContain("Publish");
    expect(html).toContain("GitHub #42");
    expect(html).toContain("Return to workstreams");
  });

  it("can use an Inbox-specific return action when embedded in mobile triage", () => {
    const html = renderToStaticMarkup(
      <TaskInspector
        task={task}
        workstreams={[workstream]}
        dependencies={[]}
        tasks={[task]}
        onBack={() => {}}
        backLabel="Return to Inbox"
      />,
    );

    expect(html).toContain(">Return to Inbox<");
    expect(html).not.toContain(">Return to workstreams<");
  });

  it("offers desktop-only blocker set, replace, and clear controls", () => {
    const html = renderToStaticMarkup(
      <TaskInspector
        task={task}
        workstreams={[workstream]}
        dependencies={[{ id: "dep-1", blockerId: "task-2", blockedId: task.id }] as Dependency[]}
        tasks={[task, { ...task, id: "task-2", title: "Approve design" }, { ...task, id: "task-3", title: "Publish" }]}
        onBack={() => {}}
        blockerEditor={{
          enabled: true,
          onSetBlocker: async () => {},
        }}
      />,
    );

    // The existing localized label supplies "Blocked by"; the enabled v1 value is title-only.
    expect(html).toContain("Approve design");
    expect(html).not.toContain("Blocked by: Approve design");
    expect(html).toContain("Replace blocker");
    expect(html).toContain("Clear blocker");
  });

  it("hides completed blockers from the enabled desktop status while preserving legacy rendering", () => {
    const props = {
      task,
      workstreams: [workstream],
      dependencies: [{ id: "dep-1", blockerId: "task-2", blockedId: task.id }] as Dependency[],
      tasks: [task, { ...task, id: "task-2", title: "Completed review", done: true }],
      onBack: () => {},
    };

    const legacy = renderToStaticMarkup(<TaskInspector {...props} />);
    const enabled = renderToStaticMarkup(<TaskInspector {...props} blockerEditor={{ enabled: true, onSetBlocker: async () => {} }} />);

    expect(legacy).toContain("Completed review");
    expect(enabled).not.toContain("Completed review");
    expect(enabled).toContain("Blocker controls");
  });

  it("renders workstream membership and protection state", () => {
    const html = renderToStaticMarkup(
      <WorkstreamInspector
        workstream={workstream}
        tasks={[task, { ...task, id: "task-2", title: "QA sign-off", done: true }]}
        dependencies={[]}
        now={new Date("2026-08-02T12:00:00.000Z")}
        onBack={() => {}}
        onOpenTask={() => {}}
        onOpenToday={() => {}}
        onOpenReview={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Inspector"');
    expect(html).toContain("Release readiness");
    expect(html).toContain("Everything needed before launch.");
    expect(html).toContain("Pinned");
    expect(html).toContain("Protected");
    expect(html).toContain("1 task");
    expect(html).toContain("Ship inspector");
    expect(html).toContain("At risk");
    expect(html).toContain("1 overdue · 0 of 1 complete");
    expect(html).toContain("Open in Inspector");
    expect(html).toContain("Open Today / Focus");
    expect(html).toContain("Open Review");
    expect(html).toContain("Return to workstreams");
  });

  it.each([
    ["en", 0, "0 tasks"],
    ["en", 1, "1 task"],
    ["en", 2, "2 tasks"],
    ["de", 0, "0 Aufgaben"],
    ["de", 1, "1 Aufgabe"],
    ["de", 2, "2 Aufgaben"],
  ] as const)("renders the %s workstream member count for %i members", (locale, count, expected) => {
    useLocale.setState({ locale });
    const html = renderToStaticMarkup(
      <WorkstreamInspector
        workstream={{ ...workstream, memberships: Array.from({ length: count }, (_, index) => ({ taskId: `task-${index}` })) }}
        tasks={[]}
        dependencies={[]}
        onBack={() => {}}
        onOpenTask={() => {}}
        onOpenToday={() => {}}
        onOpenReview={() => {}}
      />,
    );

    expect(html).toContain(expected);
  });

  it("localizes the workstream health status and reason summary in German", () => {
    useLocale.setState({ locale: "de" });
    const html = renderToStaticMarkup(
      <WorkstreamInspector
        workstream={workstream}
        tasks={[task]}
        dependencies={[]}
        now={new Date("2026-08-02T12:00:00.000Z")}
        onBack={() => {}}
        onOpenTask={() => {}}
        onOpenToday={() => {}}
        onOpenReview={() => {}}
      />,
    );

    expect(html).toContain("Gefährdet");
    expect(html).toContain("1 überfällig · 0 von 1 erledigt");
  });

  it("uses health totals and localizes the missing-membership reason", () => {
    useLocale.setState({ locale: "de" });
    const html = renderToStaticMarkup(
      <WorkstreamInspector
        workstream={{ ...workstream, memberships: [{ taskId: task.id }, { taskId: "missing-task" }] }}
        tasks={[{ ...task, done: true }]}
        dependencies={[]}
        now={new Date("2026-08-02T12:00:00.000Z")}
        onBack={() => {}}
        onOpenTask={() => {}}
        onOpenToday={() => {}}
        onOpenReview={() => {}}
      />,
    );

    expect(html).toContain("1 von 2");
    expect(html).toContain("1 Aufgabenmitgliedschaften nicht verfügbar");
  });
});
