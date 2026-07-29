// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Canvas, Task } from "../store";
import { CARD_H, CARD_W, useStore } from "../store";
import { CanvasRouter } from "./CanvasRouter";
import { SPATIAL_COMMAND_CENTER_SHELL_FLAG } from "./spatialCommandCenterFlag";

const canvas: Canvas = {
  id: "canvas-1",
  name: "Retrieval board",
  createdAt: "2026-07-29T00:00:00.000Z",
};

const task: Task = {
  id: "task-1",
  canvasId: canvas.id,
  title: "Find this task",
  description: "The existing Inspector renders this task.",
  tags: [],
  color: "#6366f1",
  x: 120,
  y: 240,
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
};

function typeQuery(container: HTMLDivElement, value: string) {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Search tasks"]');
  expect(input).not.toBeNull();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input!.dispatchEvent(new Event("input", { bubbles: true }));
}

function button(container: HTMLDivElement, label: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === label);
}

describe("CanvasRouter task retrieval", () => {
  let container: HTMLDivElement;
  let root: Root;
  let initialState: ReturnType<typeof useStore.getState>;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.assign(globalThis, {
      ResizeObserver: class {
        observe() {}
        disconnect() {}
      },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => null),
    });
    initialState = useStore.getState();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    Object.defineProperty(window, "EventSource", { configurable: true, value: class { close() {} } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
    useStore.setState(initialState, true);
    vi.unstubAllGlobals();
  });

  function setStore() {
    const optionalLoad = vi.fn(async () => {});
    useStore.setState({
      canvases: [canvas],
      tasks: [task],
      workstreams: [],
      dependencies: [],
      readOnly: false,
      loadCanvases: vi.fn(async () => [canvas]),
      refreshTasks: optionalLoad,
      loadWorkstreams: optionalLoad,
      loadBubbles: optionalLoad,
      loadDependencies: optionalLoad,
      loadPortals: optionalLoad,
      loadZones: optionalLoad,
      loadConnections: optionalLoad,
      setCardDensity: vi.fn(),
      setLiveConnected: vi.fn(),
      setSelected: vi.fn((selectedIds: string[]) => useStore.setState({ selectedIds })),
      flashTask: vi.fn(),
      flyTo: vi.fn(),
    });
  }

  async function render(matches: boolean) {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/canvas/${canvas.id}`]}>
          <Routes><Route path="/canvas/:id" element={<CanvasRouter />} /></Routes>
        </MemoryRouter>,
      );
    });
  }

  it("shows localized search in the flag-on desktop rail, opens the existing Inspector by default, and reveals explicitly", async () => {
    localStorage.setItem(SPATIAL_COMMAND_CENTER_SHELL_FLAG, "true");
    setStore();
    await render(false);

    await act(async () => typeQuery(container, "find"));
    expect(container.textContent).toContain(task.title);

    await act(async () => button(container, task.title)?.click());
    expect(container.querySelector('[aria-label="Inspector"]')).not.toBeNull();
    expect(container.textContent).toContain(task.description);
    expect(useStore.getState().setSelected).toHaveBeenCalledWith([task.id]);

    await act(async () => button(container, "Return to workstreams")?.click());
    await act(async () => typeQuery(container, "find"));
    await act(async () => button(container, "Reveal")?.click());
    expect(useStore.getState().flashTask).toHaveBeenCalledWith(task.id);
    expect(useStore.getState().flyTo).toHaveBeenCalledWith(task.x + CARD_W / 2, task.y + CARD_H / 2, 1);
    expect(container.querySelector('[aria-label="Task search results"]')).toBeNull();
  });

  it("uses the More mobile route, opens the existing Inspector by default, and closes the mobile command center after an explicit reveal", async () => {
    localStorage.setItem(SPATIAL_COMMAND_CENTER_SHELL_FLAG, "true");
    setStore();
    await render(true);

    await act(async () => button(container, "More")?.click());
    expect(container.querySelector('input[aria-label="Search tasks"]')).not.toBeNull();
    await act(async () => typeQuery(container, "find"));
    await act(async () => button(container, task.title)?.click());
    expect(container.querySelector('[aria-label="Inspector"]')).not.toBeNull();
    expect(container.textContent).toContain(task.description);

    await act(async () => button(container, "Return to More")?.click());
    await act(async () => typeQuery(container, "find"));
    await act(async () => button(container, "Reveal")?.click());

    expect(useStore.getState().setSelected).toHaveBeenCalledWith([task.id]);
    expect(useStore.getState().flashTask).toHaveBeenCalledWith(task.id);
    expect(useStore.getState().flyTo).toHaveBeenCalledWith(task.x + CARD_W / 2, task.y + CARD_H / 2, 1);
    expect(container.querySelector('[aria-label="Mobile command center"]')).toBeNull();
  });

  it("does not render task retrieval when the command center flag is off", async () => {
    setStore();
    await render(false);

    expect(container.querySelector('[aria-label="Task search"]')).toBeNull();
    expect(container.querySelector('[aria-label="Mobile command center"]')).toBeNull();
  });

  it("opens the command palette from Ctrl+K, focuses its input, and returns Escape focus to the canvas", async () => {
    const animationFrames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    setStore();
    await render(false);

    const canvas = container.querySelector<HTMLElement>('[role="region"]');
    canvas?.focus();
    expect(document.activeElement).toBe(canvas);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    });
    await act(async () => animationFrames.at(-1)?.(0));

    const input = container.querySelector<HTMLInputElement>('[role="dialog"] input');
    expect(useStore.getState().paletteOpen).toBe(true);
    expect(input).toBe(document.activeElement);

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await act(async () => animationFrames.at(-1)?.(0));

    expect(useStore.getState().paletteOpen).toBe(false);
    expect(document.activeElement).toBe(canvas);
  });
});
