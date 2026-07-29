import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Task, Workstream } from "../store";
import { MobileInboxTriage, runMobileInboxAction } from "./MobileInboxTriage";

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

describe("runMobileInboxAction", () => {
  it("returns success for the existing store callback", async () => {
    await expect(runMobileInboxAction(async () => {})).resolves.toBe(true);
  });

  it("returns failure without introducing a second optimistic mutation path", async () => {
    const mutation = vi.fn(async () => { throw new Error("network failure"); });

    await expect(runMobileInboxAction(mutation)).resolves.toBe(false);
    expect(mutation).toHaveBeenCalledTimes(1);
  });
});

describe("MobileInboxTriage", () => {
  it("renders touch-friendly inbox task cards rather than the desktop triage table", () => {
    const html = renderToStaticMarkup(
      <MobileInboxTriage
        tasks={[task]}
        workstreams={[workstream]}
        state="ready"
        onClearInbox={async () => {}}
        onSetWorkstream={async () => {}}
        onPatchTask={async () => {}}
        onOpenInspector={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Inbox triage"');
    expect(html).toContain('aria-label="Inbox tasks"');
    expect(html).toContain("Triage customer feedback");
    expect(html).toContain("High");
    expect(html).toContain("Aug 1, 2026");
    expect(html).toContain("Customer success");
    expect(html).toContain("Move out of Inbox");
    expect(html).toContain("Open in Inspector");
    expect(html).not.toContain("<table");
  });
});
