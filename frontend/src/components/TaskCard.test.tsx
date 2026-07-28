import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskCard, taskCardTransition } from "./TaskCard";
import type { Task } from "../store";

const task = {
  id: "task-1",
  canvasId: "canvas-1",
  title: "Ship density controls",
  description: "This description is intentionally hidden in high density.",
  x: 120,
  y: 80,
  z: 1,
  color: "#22d3ee",
  priority: "high",
  dueDate: null,
  estimateMinutes: null,
  actualMinutes: 0,
  recurrence: null,
  snoozedUntil: null,
  done: false,
  archivedAt: null,
  tags: ["ui"],
  status: "In progress",
  externalKey: "github:owner/repo#1",
  externalUrl: null,
  connectionId: null,
  checklist: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  lastActivityAt: "2026-01-01T00:00:00.000Z",
  inbox: false,
  provider: null,
  externalMeta: null,
  syncedAt: null,
} satisfies Task;

describe("TaskCard semantic density", () => {
  it("keeps the title and a text-backed status while hiding nonessential high-density details", () => {
    const html = renderToStaticMarkup(
      <TaskCard task={task} dimmed={false} blocked={false} semanticDensity="high" onEdit={() => {}} />,
    );

    expect(html).toContain("Ship density controls");
    expect(html).toContain("In progress");
    expect(html).not.toContain("This description is intentionally hidden in high density.");
  });

  it("uses the semantic density scale for card content while retaining the card hit area", () => {
    const html = renderToStaticMarkup(
      <TaskCard task={task} dimmed={false} blocked={false} semanticDensity="high" onEdit={() => {}} />,
    );

    expect(html).toContain("--semantic-card-scale:0.8");
    expect(html).toContain("width:256px");
    expect(html).toContain("height:170px");
    expect(html).toContain("padding:12.8px");
  });

  it("disables card motion when reduced motion is requested", () => {
    expect(taskCardTransition(true, false)).toEqual({ duration: 0 });
  });
});
