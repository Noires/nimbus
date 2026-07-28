import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Task, Workstream } from "../store";
import { InboxTriage } from "./InboxTriage";

const task = {
  id: "task-1",
  canvasId: "canvas-1",
  title: "Triage customer feedback",
  description: "",
  tags: ["support"],
  color: "#6366f1",
  x: 100,
  y: 200,
  z: 1,
  dueDate: "2026-08-01T00:00:00.000Z",
  priority: "high",
  done: false,
  archivedAt: null,
  createdAt: "2026-07-28T00:00:00.000Z",
  inbox: true,
  snoozedUntil: null,
  estimateMinutes: null,
  recurrence: null,
  lastActivityAt: "2026-07-28T00:00:00.000Z",
  actualMinutes: 0,
  provider: null,
  connectionId: null,
  externalKey: null,
  externalUrl: null,
  status: null,
  externalMeta: null,
  syncedAt: null,
  checklist: [],
} as Task;

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
} as Workstream;

const actions = {
  onCapture: async () => {},
  onClearInbox: async () => {},
  onSetWorkstream: async () => {},
  onPatchTask: async () => {},
  onReveal: () => {},
};

describe("InboxTriage", () => {
  it("renders a keyboard-capture form and an accessible triage table with existing task metadata and actions", () => {
    const html = renderToStaticMarkup(
      <InboxTriage tasks={[task]} workstreams={[workstream]} state="ready" {...actions} />,
    );

    expect(html).toContain('aria-label="Inbox triage"');
    expect(html).toContain('placeholder="Capture into Inbox"');
    expect(html).toContain('aria-label="Inbox tasks"');
    expect(html).toContain("Triage customer feedback");
    expect(html).toContain("High");
    expect(html).toContain("Aug 1, 2026");
    expect(html).toContain("Customer success");
    expect(html).toContain("Move out of Inbox");
    expect(html).toContain("Open in Inspector");
  });

  it.each([
    ["loading", "Loading Inbox…"],
    ["error", "Inbox could not be loaded."],
    ["ready", "Inbox is clear. Capture a task to start triage."],
  ] as const)("renders a clear %s state", (state, expected) => {
    const html = renderToStaticMarkup(
      <InboxTriage tasks={[]} workstreams={[]} state={state} {...actions} />,
    );

    expect(html).toContain(expected);
  });
});
