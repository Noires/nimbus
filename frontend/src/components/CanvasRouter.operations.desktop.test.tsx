// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Canvas, Task, Workstream } from "../store";
import { CARD_H, CARD_W, useStore } from "../store";
import { CanvasRouter } from "./CanvasRouter";

const canvas: Canvas = {
  id: "canvas-operations",
  name: "Operations board",
  createdAt: "2026-07-29T00:00:00.000Z",
};

const operationsTask: Task = {
  id: "task-operations",
  canvasId: canvas.id,
  title: "Run Operations integration",
  description: "Operations uses the shared Inspector callback.",
  tags: [],
  color: "#6366f1",
  x: 120,
  y: 240,
  z: 0,
  dueDate: null,
  priority: "high",
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

const workstream: Workstream = {
  id: "workstream-operations",
  canvasId: canvas.id,
  name: "Operations readiness",
  description: null,
  pinned: false,
  protected: false,
  memberships: [{ taskId: operationsTask.id }],
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
};

function renderRouter(root: Root) {
  root.render(
    <MemoryRouter initialEntries={[`/canvas/${canvas.id}`]}>
      <Routes>
        <Route path="/canvas/:id" element={<CanvasRouter />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CanvasRouter desktop Operations rail", () => {
  let container: HTMLDivElement;
  let root: Root;
  let initialState: ReturnType<typeof useStore.getState>;
  let setSelected = vi.fn<(ids: string[]) => void>();
  let flashTask = vi.fn<(id: string) => void>();
  let flyTo = vi.fn<(worldX: number, worldY: number, zoom?: number) => void>();

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
    setSelected = vi.fn((ids) => initialState.setSelected(ids));
    flashTask = vi.fn((id) => initialState.flashTask(id));
    flyTo = vi.fn((worldX, worldY, zoom) => initialState.flyTo(worldX, worldY, zoom));
    useStore.setState({
      canvases: [canvas],
      tasks: [operationsTask],
      workstreams: [workstream],
      dependencies: [],
      readOnly: true,
      loadCanvases: vi.fn(async () => [canvas]),
      refreshTasks: vi.fn(async () => {}),
      loadWorkstreams: vi.fn(async () => {}),
      loadBubbles: optionalLoad,
      loadDependencies: optionalLoad,
      loadPortals: optionalLoad,
      loadZones: optionalLoad,
      loadConnections: optionalLoad,
      setSelected,
      flashTask,
      flyTo,
      setCardDensity: vi.fn(),
      setLiveConnected: vi.fn(),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
    useStore.setState(initialState, true);
  });

  it.each([
    ["absent", null],
    ["malformed", "enabled"],
    ["true", "true"],
  ])("renders desktop Operations with a %s retired legacy value", async (_description, legacyValue) => {
    if (legacyValue !== null) localStorage.setItem("nimbus:spatial-command-center-shell", legacyValue);

    await act(async () => renderRouter(root));

    expect(container.querySelector('[data-operations-view="desktop-contextual-rail"]')).not.toBeNull();
  });

  it("opens the shared Inspector and reveals the task from the desktop Operations rail", async () => {
    await act(async () => renderRouter(root));

    expect(container.querySelector('[data-operations-view="desktop-contextual-rail"]')).not.toBeNull();
    const inspectorButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Open in Inspector");
    expect(inspectorButton).toBeDefined();

    await act(async () => inspectorButton?.click());

    expect(setSelected).toHaveBeenCalledWith([operationsTask.id]);
    expect(container.querySelector('[aria-label="Inspector"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Blocker controls"]')).not.toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Inspector"] button')?.click();
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Reveal")?.click();
    });

    expect(flashTask).toHaveBeenCalledWith(operationsTask.id);
    expect(flyTo).toHaveBeenCalledWith(operationsTask.x + CARD_W / 2, operationsTask.y + CARD_H / 2, 1);
  });
});
