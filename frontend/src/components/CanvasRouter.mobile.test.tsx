// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Canvas, Task, Workstream } from "../store";
import { useStore } from "../store";
import { SPATIAL_COMMAND_CENTER_SHELL_FLAG } from "./spatialCommandCenterFlag";
import { CanvasRouter } from "./CanvasRouter";

const canvas: Canvas = {
  id: "canvas-1",
  name: "Mobile board",
  createdAt: "2026-07-29T00:00:00.000Z",
};

const inboxTask: Task = {
  id: "task-1",
  canvasId: canvas.id,
  title: "Inspect me from Inbox",
  description: "The mobile Inspector route must render the real inspector.",
  tags: ["mobile"],
  color: "#6366f1",
  x: 0,
  y: 0,
  z: 0,
  dueDate: null,
  priority: "high",
  done: false,
  archivedAt: null,
  createdAt: "2026-07-29T00:00:00.000Z",
  inbox: true,
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

const todayTask: Task = {
  ...inboxTask,
  id: "task-today",
  title: "Ship Mobile Today",
  description: "Mobile Today must return here after inspection.",
  inbox: false,
  dueDate: "2026-07-29T18:00:00.000Z",
};

const reviewTask: Task = {
  ...todayTask,
  id: "task-review",
  title: "Review an overdue mobile task",
  dueDate: "2026-07-28T18:00:00.000Z",
};

const workstream: Workstream = {
  id: "workstream-1",
  canvasId: canvas.id,
  name: "Mobile readiness",
  description: null,
  pinned: false,
  protected: false,
  memberships: [{ taskId: inboxTask.id }],
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("CanvasRouter mobile command center", () => {
  let container: HTMLDivElement;
  let root: Root;
  let initialState: ReturnType<typeof useStore.getState>;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    initialState = useStore.getState();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    localStorage.setItem(SPATIAL_COMMAND_CENTER_SHELL_FLAG, "true");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    Object.defineProperty(window, "EventSource", {
      configurable: true,
      value: class {
        close() {}
      },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
    useStore.setState(initialState, true);
  });

  it("shows Inbox loading until required data settles, then opens the real Inspector route", async () => {
    const canvasList = deferred();
    const requiredData = deferred();
    const loadCanvases = vi.fn(async () => {
      await canvasList.promise;
      return [canvas];
    });
    const refreshTasks = vi.fn(async () => requiredData.promise);
    const loadWorkstreams = vi.fn(async () => requiredData.promise);
    const optionalLoad = vi.fn(async () => {});

    useStore.setState({
      canvases: [canvas],
      tasks: [inboxTask],
      workstreams: [workstream],
      dependencies: [],
      readOnly: false,
      loadCanvases,
      refreshTasks,
      loadWorkstreams,
      loadBubbles: optionalLoad,
      loadDependencies: optionalLoad,
      loadPortals: optionalLoad,
      loadZones: optionalLoad,
      loadConnections: optionalLoad,
      setCardDensity: vi.fn(),
      setLiveConnected: vi.fn(),
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/canvas/${canvas.id}`]}>
          <Routes>
            <Route path="/canvas/:id" element={<CanvasRouter />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    await act(async () => canvasList.resolve());
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-current="page"]')?.click();
      const inboxButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Inbox");
      inboxButton?.click();
    });

    expect(loadCanvases).toHaveBeenCalledOnce();
    expect(refreshTasks).toHaveBeenCalledWith(canvas.id);
    expect(loadWorkstreams).toHaveBeenCalledWith(canvas.id);
    expect(container.textContent).toContain("Loading Inbox…");

    await act(async () => requiredData.resolve());

    expect(container.textContent).toContain(inboxTask.title);
    const inspectorButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Open in Inspector");
    expect(inspectorButton).toBeDefined();

    inspectorButton?.focus();
    await act(async () => inspectorButton?.click());

    expect(container.querySelector('[aria-label="Inspector"]')).not.toBeNull();
    expect(container.textContent).toContain(inboxTask.description);
    expect(container.textContent).toContain("Return to Inbox");

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Return to Inbox")?.click();
    });

    expect(container.textContent).toContain(inboxTask.title);
    const restoredInspectorButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Open in Inspector");
    expect(document.activeElement).toBe(restoredInspectorButton);
  });

  it("opens Today on mobile and returns an Inspector action to Today with its trigger focused", async () => {
    const optionalLoad = vi.fn(async () => {});
    useStore.setState({
      canvases: [canvas],
      tasks: [todayTask],
      workstreams: [],
      dependencies: [],
      readOnly: false,
      loadCanvases: vi.fn(async () => [canvas]),
      refreshTasks: vi.fn(async () => {}),
      loadWorkstreams: vi.fn(async () => {}),
      loadBubbles: optionalLoad,
      loadDependencies: optionalLoad,
      loadPortals: optionalLoad,
      loadZones: optionalLoad,
      loadConnections: optionalLoad,
      setCardDensity: vi.fn(),
      setLiveConnected: vi.fn(),
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/canvas/${canvas.id}`]}>
          <Routes>
            <Route path="/canvas/:id" element={<CanvasRouter />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Today")?.click();
    });
    expect(container.textContent).toContain(todayTask.title);

    const inspectorButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Open in Inspector");
    expect(inspectorButton).toBeDefined();
    inspectorButton?.focus();
    await act(async () => inspectorButton?.click());

    expect(container.querySelector('[aria-label="Inspector"]')).not.toBeNull();
    expect(container.textContent).toContain("Return to Today");

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Return to Today")?.click();
    });

    expect(container.textContent).toContain(todayTask.title);
    const restoredInspectorButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Open in Inspector");
    expect(document.activeElement).toBe(restoredInspectorButton);
  });

  it("opens one Review queue at a time and Escape returns its Inspector action before closing focus mode", async () => {
    const optionalLoad = vi.fn(async () => {});
    useStore.setState({
      canvases: [canvas],
      tasks: [reviewTask],
      workstreams: [],
      dependencies: [],
      readOnly: false,
      loadCanvases: vi.fn(async () => [canvas]),
      refreshTasks: vi.fn(async () => {}),
      loadWorkstreams: vi.fn(async () => {}),
      loadBubbles: optionalLoad,
      loadDependencies: optionalLoad,
      loadPortals: optionalLoad,
      loadZones: optionalLoad,
      loadConnections: optionalLoad,
      setCardDensity: vi.fn(),
      setLiveConnected: vi.fn(),
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/canvas/${canvas.id}`]}>
          <Routes>
            <Route path="/canvas/:id" element={<CanvasRouter />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Review")?.click();
    });
    expect(container.textContent).toContain(reviewTask.title);
    expect(container.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(1);

    const inspectorButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Open in Inspector");
    expect(inspectorButton).toBeDefined();
    inspectorButton?.focus();
    await act(async () => inspectorButton?.click());
    expect(container.textContent).toContain("Return to Review");

    const focusBeforeEscape = { members: [reviewTask.id], index: 0, prevView: { zoom: 1, panX: 0, panY: 0 } };
    await act(async () => {
      useStore.setState({ focus: focusBeforeEscape });
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(container.textContent).toContain(reviewTask.title);
    expect(useStore.getState().focus).toEqual(focusBeforeEscape);
    const restoredInspectorButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Open in Inspector");
    expect(document.activeElement).toBe(restoredInspectorButton);
  });
});
