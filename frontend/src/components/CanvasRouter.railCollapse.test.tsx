// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Canvas, Task } from "../store";
import { useStore } from "../store";
import { CanvasRouter } from "./CanvasRouter";

const canvas: Canvas = { id: "canvas-rail", name: "Rail board", createdAt: "2026-08-01T00:00:00.000Z" };

const task: Task = {
  id: "task-rail",
  canvasId: canvas.id,
  title: "Rail regression task",
  description: "",
  tags: [],
  color: "#6366f1",
  x: 10,
  y: 10,
  z: 0,
  dueDate: null,
  priority: "medium",
  done: false,
  archivedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  inbox: false,
  snoozedUntil: null,
  estimateMinutes: null,
  recurrence: null,
  lastActivityAt: "2026-08-01T00:00:00.000Z",
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

describe("CanvasRouter rail collapse", () => {
  let container: HTMLDivElement;
  let root: Root;
  let initialState: ReturnType<typeof useStore.getState>;

  beforeEach(() => {
    Object.assign(globalThis, {
      IS_REACT_ACT_ENVIRONMENT: true,
      ResizeObserver: class {
        observe() {}
        disconnect() {}
      },
    });
    initialState = useStore.getState();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    Object.defineProperty(window, "EventSource", {
      configurable: true,
      value: class { close() {} },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => null),
    });
    const optionalLoad = vi.fn(async () => {});
    useStore.setState({
      canvases: [canvas],
      tasks: [task],
      workstreams: [],
      dependencies: [],
      loadCanvases: vi.fn(async () => [canvas]),
      refreshTasks: vi.fn(async () => {}),
      loadWorkstreams: vi.fn(async () => {}),
      loadBubbles: optionalLoad,
      loadDependencies: optionalLoad,
      loadPortals: optionalLoad,
      loadZones: optionalLoad,
      loadConnections: optionalLoad,
      setLiveConnected: vi.fn(),
      setCardDensity: vi.fn(),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
    useStore.setState(initialState, true);
  });

  async function render() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/canvas/${canvas.id}`]}>
          <Routes>
            <Route path="/canvas/:id/*" element={<CanvasRouter />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  const closeButton = () => container.querySelector<HTMLButtonElement>(".command-center-shell__rail-close");
  const opener = () => container.querySelector<HTMLButtonElement>(".command-center-shell__rail-open");
  const railEl = () => container.querySelector(".command-center-shell__rail");

  it("collapses the utilities rail on wide desktop and reopens it from the header", async () => {
    await render();

    expect(railEl()).not.toBeNull();
    expect(closeButton()?.textContent).toBe("Close panel");

    await act(async () => closeButton()?.click());
    // The rail is really gone — the field gets the full width.
    expect(railEl()).toBeNull();
    expect(opener()).not.toBeNull();
    expect(opener()?.textContent).toBe("Utilities");

    await act(async () => opener()?.click());
    expect(railEl()).not.toBeNull();
    expect(opener()).toBeNull();
  });

  it("labels the close action for the inspector and deselects on close", async () => {
    await render();

    await act(async () => useStore.setState({ selectedIds: [task.id] }));
    expect(container.querySelector('[aria-label="Inspector"]')).not.toBeNull();
    expect(closeButton()?.textContent).toBe("Close inspector");

    await act(async () => closeButton()?.click());
    expect(useStore.getState().selectedIds).toHaveLength(0);
    expect(closeButton()?.textContent).toBe("Close panel");
  });

  it("shows the inspector even while the rail is collapsed", async () => {
    await render();

    await act(async () => closeButton()?.click());
    expect(railEl()).toBeNull();

    await act(async () => useStore.setState({ selectedIds: [task.id] }));
    expect(railEl()).not.toBeNull();
    expect(container.querySelector('[aria-label="Inspector"]')).not.toBeNull();

    // Closing the inspector returns to the collapsed state, not the directory.
    await act(async () => closeButton()?.click());
    expect(railEl()).toBeNull();
    expect(opener()).not.toBeNull();
  });
});
