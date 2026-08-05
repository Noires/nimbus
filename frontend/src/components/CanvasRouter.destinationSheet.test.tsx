// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Canvas, Task } from "../store";
import { useStore } from "../store";
import { CanvasRouter } from "./CanvasRouter";

const canvas: Canvas = {
  id: "canvas-sheet",
  name: "Sheet board",
  createdAt: "2026-08-01T00:00:00.000Z",
};

const task: Task = {
  id: "task-sheet",
  canvasId: canvas.id,
  title: "Sheet regression task",
  description: "",
  tags: [],
  color: "#6366f1",
  x: 40,
  y: 60,
  z: 0,
  dueDate: null,
  priority: "medium",
  done: false,
  archivedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  inbox: true,
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

function renderRouter(root: Root, path: string) {
  root.render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/canvas/:id/*" element={<CanvasRouter />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CanvasRouter destination sheets", () => {
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

  it("keeps the canvas mounted underneath the Today sheet", async () => {
    await act(async () => renderRouter(root, `/canvas/${canvas.id}/today`));

    expect(container.querySelector('[data-destination-sheet="today"]')).not.toBeNull();
    expect(container.querySelector('[data-workspace="today"]')).not.toBeNull();
    // The spatial field stays alive behind the sheet.
    expect(container.querySelector('[data-workspace="canvas"]')).not.toBeNull();
  });

  it("closes the sheet back to the canvas route", async () => {
    await act(async () => renderRouter(root, `/canvas/${canvas.id}/today`));

    const close = container.querySelector<HTMLButtonElement>(".destination-sheet__close");
    expect(close).not.toBeNull();
    await act(async () => close?.click());

    expect(container.querySelector(".destination-sheet")).toBeNull();
    expect(container.querySelector('[data-workspace="canvas"]')).not.toBeNull();
  });

  it("renders no sheet on the plain canvas route", async () => {
    await act(async () => renderRouter(root, `/canvas/${canvas.id}`));

    expect(container.querySelector(".destination-sheet")).toBeNull();
    expect(container.querySelector('[data-workspace="canvas"]')).not.toBeNull();
  });

  it("starts the guided tour from the canvas route even when opened on a sheet", async () => {
    await act(async () => renderRouter(root, `/canvas/${canvas.id}/today`));
    expect(container.querySelector('[data-destination-sheet="today"]')).not.toBeNull();

    const start = [...container.querySelectorAll("button")].find((b) => b.textContent === "Start tour");
    expect(start).toBeDefined();
    await act(async () => start?.click());

    // The sheet closed: the tour's toolbar step needs the canvas route.
    expect(container.querySelector(".destination-sheet")).toBeNull();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("opens capture from the navigation on a destination route (regression)", async () => {
    await act(async () => renderRouter(root, `/canvas/${canvas.id}/inbox`));

    const capture = container.querySelector<HTMLButtonElement>('button[aria-label="Capture"]');
    expect(capture).not.toBeNull();
    await act(async () => capture?.click());

    // CreateModal is route-independent now: its title field must appear.
    expect(container.querySelector('input[placeholder]')).not.toBeNull();
    expect(container.textContent).toContain("New Task");
  });
});
