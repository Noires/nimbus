// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskCard, taskCardTransition } from "./TaskCard";
import { useStore, type Task } from "../store";

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
  it("keeps the existing focus target without listbox option semantics", () => {
    const html = renderToStaticMarkup(
      <TaskCard task={task} dimmed={false} blocked={false} selected semanticDensity="normal" onEdit={() => {}} />,
    );

    expect(html).toMatch(/tabindex="0"/);
    expect(html).toMatch(/aria-label="Ship density controls"/);
    expect(html).not.toMatch(/role="option"/);
    expect(html).not.toMatch(/aria-selected=/);
  });

  it("gives its focus target a distinct high-contrast focus-visible outline", () => {
    const html = renderToStaticMarkup(
      <TaskCard task={task} dimmed={false} blocked={false} semanticDensity="normal" onEdit={() => {}} />,
    );

    expect(html).toMatch(/focus-visible:outline-4/);
    expect(html).toMatch(/focus-visible:outline-offset-4/);
    expect(html).toMatch(/focus-visible:outline-nc-focus/);
  });

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

describe("TaskCard pointer selection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Element.prototype.setPointerCapture = () => {};
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    useStore.setState({
      tasks: [task],
      selectedIds: [],
      draggingTaskId: null,
      lens: "off",
      readOnly: false,
      zones: [],
      patchTask: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const pointer = (type: string, clientX: number, clientY: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { button: 0, pointerId: 1, clientX, clientY });
    return event;
  };

  it("selects an ordinary card click after pointer release", async () => {
    await act(async () => {
      root.render(<TaskCard task={task} dimmed={false} blocked={false} onEdit={() => {}} />);
    });
    const card = container.querySelector<HTMLElement>(`[aria-label="${task.title}"]`)!;

    await act(async () => {
      card.dispatchEvent(pointer("pointerdown", 20, 20));
      card.dispatchEvent(pointer("pointerup", 20, 20));
    });

    expect(useStore.getState().selectedIds).toEqual([task.id]);
  });

  it("does not select a card when its pointer gesture moved it", async () => {
    await act(async () => {
      root.render(<TaskCard task={task} dimmed={false} blocked={false} onEdit={() => {}} />);
    });
    const card = container.querySelector<HTMLElement>(`[aria-label="${task.title}"]`)!;

    await act(async () => {
      card.dispatchEvent(pointer("pointerdown", 20, 20));
      card.dispatchEvent(pointer("pointermove", 40, 20));
      card.dispatchEvent(pointer("pointerup", 40, 20));
    });

    expect(useStore.getState().selectedIds).toEqual([]);
  });
});
