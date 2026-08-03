import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Dependency, Task, Workstream } from "../data/api";
import { OperationsView } from "./OperationsView";

const task = (id: string, title: string): Task => ({
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
});

const workstream: Workstream = {
  id: "ws-a",
  canvasId: "canvas-1",
  name: "Alpha",
  description: null,
  pinned: false,
  protected: false,
  memberships: [{ taskId: "task-1" }],
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
};

describe("OperationsView", () => {
  it("renders shared workstream health, open count, priority, and Today state", () => {
    const dueToday = task("task-1", "Assigned task");
    dueToday.priority = "high";
    dueToday.dueDate = "2026-07-29T12:00:00.000Z";
    const blocker = { ...task("blocker", "Hidden blocker"), inbox: true };
    const dependencies: Dependency[] = [{ id: "dependency-1", blockerId: blocker.id, blockedId: dueToday.id }];
    const html = renderToStaticMarkup(
      <OperationsView
        tasks={[dueToday, blocker, task("task-2", "Unassigned task")]}
        workstreams={[workstream]}
        dependencies={dependencies}
        now={new Date("2026-07-29T08:00:00.000Z")}
        onOpenInspector={() => {}}
        onReveal={() => {}}
      />,
    );

    expect(html).toContain('data-workstream-open-count="1"');
    expect(html).toContain('data-workstream-health="blocked"');
    expect(html).toContain('data-workstream-health-reason="open-blockers"');
    expect(html).toContain("Blocked");
    expect(html).toContain("1 blocked");
    expect(html).toContain('data-task-priority="high"');
    expect(html).toContain('data-task-today="true"');
    expect(html).toContain("Today");
  });

  it("renders the local derived canonical workstream projection without controls", () => {
    const html = renderToStaticMarkup(
      <OperationsView
        tasks={[task("task-1", "Assigned task"), task("task-2", "Unassigned task")]}
        workstreams={[workstream]}
        dependencies={[]}
        onOpenInspector={() => {}}
        onReveal={() => {}}
        mobile
      />,
    );

    expect(html).toContain('data-operations-view="local-derived"');
    expect(html).toContain("mobile-operations__task");
    expect(html).toContain("mobile-operations__actions");
    expect(html).toContain('aria-label="Operations"');
    expect(html).toContain("Alpha");
    expect(html).toContain("Assigned task");
    expect(html).toContain("Unassigned");
    expect(html).toContain("Unassigned task");
    expect(html).toContain(">Open in Inspector<");
    expect(html).toContain(">Reveal<");
    expect(html).not.toContain("form");
  });
});
