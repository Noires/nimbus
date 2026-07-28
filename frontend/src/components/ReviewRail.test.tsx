import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Dependency, Task } from "../store";
import { ReviewRail } from "./ReviewRail";

const task = (id: string, title: string, overrides: Partial<Task> = {}): Task => ({
  id,
  canvasId: "canvas-1",
  x: 100,
  y: 200,
  z: 1,
  title,
  description: "",
  tags: [],
  color: "#6366f1",
  dueDate: null,
  priority: "medium",
  done: false,
  archivedAt: null,
  createdAt: "2026-07-20T00:00:00.000Z",
  inbox: false,
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
  ...overrides,
});

const actions = {
  onComplete: async () => {},
  onOpenInspector: () => {},
  onReveal: () => {},
  onFocus: () => {},
  onOpenToday: () => {},
  onOpenInbox: () => {},
};

describe("ReviewRail", () => {
  it("renders one selected weekly queue with safe task and operating-loop actions", () => {
    const html = renderToStaticMarkup(
      <ReviewRail
        state="ready"
        selectedQueue="overdue"
        now={new Date("2026-07-28T12:00:00.000Z")}
        tasks={[
          task("overdue", "Resolve incident", { dueDate: "2026-07-27T12:00:00.000Z" }),
          task("inbox", "Triage note", { inbox: true }),
        ]}
        dependencies={[]}
        {...actions}
      />,
    );

    expect(html).toContain('aria-label="Weekly review"');
    expect(html).toContain("Overdue");
    expect(html).toContain("Due soon (next 7 days)");
    expect(html).toContain("Blocked");
    expect(html).toContain("Stale (14+ days)");
    expect(html).toContain("Inbox to triage");
    expect(html).toContain("Recently completed");
    expect(html).toContain("Resolve incident");
    expect(html).not.toContain("Triage note");
    expect(html).toContain("Open in Inspector");
    expect(html).toContain("Reveal on canvas");
    expect(html).toContain("Complete");
    expect(html).toContain("Focus");
    expect(html).toContain("Open Today / Focus");
    expect(html).toContain("Open Inbox");
  });

  it.each([
    ["loading", "Loading review…"],
    ["error", "Review could not be loaded."],
    ["ready", "No tasks in this queue."],
  ] as const)("renders a clear %s state", (state, expected) => {
    const html = renderToStaticMarkup(
      <ReviewRail state={state} selectedQueue="overdue" tasks={[]} dependencies={[] as Dependency[]} {...actions} />,
    );

    expect(html).toContain(expected);
  });
});
