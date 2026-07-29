// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskSchema } from "../data/api";
import type { ArrangementPreview } from "../engine/arrangementOperation";
import { history } from "../engine/history";
import { useStore } from "../store";
import { SelectionBar, SelectionTidyPreview } from "./SelectionBar";

const preview: ArrangementPreview = {
  strategy: "tidy-overlaps",
  scope: "selected",
  moved: [{ id: "task-b", x: 120, y: 0 }],
  unchanged: ["task-a"],
  skipped: [
    { id: "task-c", reason: "protected-task" },
    { id: "task-d", reason: "pinned-workstream" },
  ],
  positions: [{ id: "task-b", x: 120, y: 0 }],
  inverse: [{ id: "task-b", x: 0, y: 0 }],
  isNoop: false,
  explanation: "Tidy overlaps will move 1 of 2 eligible cards.",
  explanations: ["Tidy overlaps will move 1 of 2 eligible cards.", "Skipped 2 selected cards."],
  revision: "current",
};

describe("SelectionTidyPreview", () => {
  it("explains selected-task moved, unchanged, and skipped counts with skip reasons before applying", () => {
    const html = renderToStaticMarkup(
      <SelectionTidyPreview preview={preview} onApply={async () => {}} onCancel={() => {}} />,
    );

    expect(html).toContain("1 moved");
    expect(html).toContain("1 unchanged");
    expect(html).toContain("2 skipped");
    expect(html).toContain("1 protected task");
    expect(html).toContain("1 pinned workstream");
    expect(html).toContain("Apply tidy");
    expect(html).toContain("Cancel");
  });
});

const task = (id: string, x: number, y: number) => TaskSchema.parse({
  id,
  canvasId: "canvas-1",
  x,
  y,
  z: 0,
  title: id,
  description: "",
  tags: [],
  color: "blue",
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
  checklist: [],
});

describe("SelectionBar selected-task tidy", () => {
  let container: HTMLDivElement;
  let root: Root;
  let initialState: ReturnType<typeof useStore.getState>;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    initialState = useStore.getState();
    history.clear();
    useStore.setState({
      tasks: [task("a", 0, 0), task("b", 0, 0)],
      selectedIds: ["b", "a"],
      workstreams: [],
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    history.clear();
    useStore.setState(initialState, true);
    vi.unstubAllGlobals();
  });

  it("keeps selected-task tidy unavailable unless the feature flag is enabled", async () => {
    await act(async () => {
      root.render(<SelectionBar canvasId="canvas-1" tidyEnabled={false} />);
    });

    expect(container.textContent).not.toContain("Tidy selected");
  });

  it("announces the localized selected count and gives each bulk action an accessible label", async () => {
    await act(async () => {
      root.render(<SelectionBar canvasId="canvas-1" tidyEnabled={false} />);
    });

    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.textContent).toBe("2 selected");
    expect(container.querySelector('button[aria-label="Complete"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Clear selection"]')).not.toBeNull();
  });

  it("keeps selected-task tidy unavailable with fewer than two selected IDs", async () => {
    useStore.setState({ selectedIds: ["a"] });
    await act(async () => {
      root.render(<SelectionBar canvasId="canvas-1" tidyEnabled />);
    });

    expect(container.textContent).not.toContain("Tidy selected");
  });

  it("previews deterministically, persists once only after Apply, and creates one undo entry", async () => {
    const fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const patch = JSON.parse(String(init?.body));
      if (url === "/api/tasks/positions") {
        expect(init?.method).toBe("POST");
        const tasks = patch.positions.map((position: { id: string; x: number; y: number }) => ({
          ...useStore.getState().tasks.find((candidate) => candidate.id === position.id)!,
          ...position,
        }));
        return new Response(JSON.stringify({ tasks }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      expect(url).toBe("/api/tasks/b");
      expect(init?.method).toBe("PATCH");
      return new Response(JSON.stringify({
        ...useStore.getState().tasks.find((candidate) => candidate.id === "b")!,
        ...patch,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetch);
    await act(async () => {
      root.render(<SelectionBar canvasId="canvas-1" tidyEnabled />);
    });

    const tidy = [...container.querySelectorAll("button")].find((button) => button.textContent === "⇄ Tidy selected");
    expect(tidy).toBeDefined();
    await act(async () => tidy?.click());
    expect(fetch).not.toHaveBeenCalled();
    expect(container.textContent).toContain("1 moved");
    expect(container.textContent).toContain("1 unchanged");

    const apply = [...container.querySelectorAll("button")].find((button) => button.textContent === "Apply tidy");
    await act(async () => apply?.click());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(history.canUndo).toBe(true);

    await useStore.getState().undo();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(useStore.getState().tasks.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
    ]);
    await useStore.getState().undo();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("disables Apply while a delayed tidy persistence is in flight", async () => {
    let resolveResponse!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    }));
    vi.stubGlobal("fetch", fetch);
    await act(async () => {
      root.render(<SelectionBar canvasId="canvas-1" tidyEnabled />);
    });

    const tidy = [...container.querySelectorAll("button")].find((button) => button.textContent === "⇄ Tidy selected");
    await act(async () => tidy?.click());
    const apply = [...container.querySelectorAll("button")].find((button) => button.textContent === "Apply tidy");
    await act(async () => {
      apply?.click();
      await Promise.resolve();
    });

    const applying = [...container.querySelectorAll("button")].find((button) => button.textContent === "Apply tidy");
    expect(applying?.disabled).toBe(true);
    applying?.click();
    expect(fetch).toHaveBeenCalledTimes(1);

    resolveResponse(new Response(JSON.stringify({
      tasks: [{ ...useStore.getState().tasks.find((task) => task.id === "b")!, x: 120, y: 0 }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await act(async () => {});
    expect(history.canUndo).toBe(true);
  });
});
