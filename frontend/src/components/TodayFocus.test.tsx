import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Dependency, Task } from "../store";
import { TodayFocus } from "./TodayFocus";

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
  createdAt: "2026-07-28T00:00:00.000Z",
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

const dependencies: Dependency[] = [{ id: "dep-1", blockerId: "blocker", blockedId: "blocked" }];
const actions = {
  onComplete: async () => {},
  onReturnToInbox: async () => {},
  onOpenInspector: () => {},
  onReveal: () => {},
  onFocus: () => {},
};

describe("TodayFocus", () => {
  it("renders accessible bounded execution sections and existing-safe actions", () => {
    const html = renderToStaticMarkup(
      <TodayFocus
        state="ready"
        now={new Date("2026-07-28T12:00:00.000Z")}
        tasks={[
          task("due", "Send brief", { dueDate: "2026-07-28T18:00:00.000Z" }),
          task("ready", "Plan next sprint"),
          task("blocked", "Publish release"),
          task("blocker", "Wait for review"),
          task("done", "Closed loop", { done: true }),
        ]}
        dependencies={dependencies}
        focusEnabled
        {...actions}
      />,
    );

    expect(html).toContain('aria-label="Today and Focus"');
    expect(html).toContain("Due today / overdue");
    expect(html).toContain("Ready next");
    expect(html).toContain("Blocked / waiting");
    expect(html).toContain("Recently completed");
    expect(html).toContain("Send brief");
    expect(html).toContain("Complete");
    expect(html).toContain("Open in Inspector");
    expect(html).toContain("Reveal on canvas");
    expect(html).toContain("Return to Inbox");
    expect(html).toContain("Focus");
  });

  it.each([
    ["loading", "Loading Today…"],
    ["error", "Today could not be loaded."],
    ["ready", "Nothing needs attention right now."],
  ] as const)("renders a clear %s state", (state, expected) => {
    const html = renderToStaticMarkup(
      <TodayFocus state={state} tasks={[]} dependencies={[]} {...actions} />,
    );

    expect(html).toContain(expected);
  });
});
