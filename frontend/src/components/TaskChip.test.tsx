import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskChip } from "./TaskChip";
import type { Task } from "../store";

const task = {
  id: "task-1",
  canvasId: "canvas-1",
  title: "Readable even when zoomed out",
  description: "",
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
  tags: [],
  status: null,
  externalKey: null,
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

describe("TaskChip", () => {
  it("renders a visible accessible task title for dot-level cards", () => {
    const html = renderToStaticMarkup(<TaskChip task={task} dot dimmed={false} />);

    expect(html).toContain("Readable even when zoomed out");
    expect(html).toContain('aria-label="Open task: Readable even when zoomed out"');
    expect(html).toContain("semantic-dot-title");
  });
});
