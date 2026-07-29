// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../store";
import { CommandPalette } from "./CommandPalette";

describe("CommandPalette accessibility", () => {
  let container: HTMLDivElement;
  let root: Root;
  let trigger: HTMLButtonElement;
  let initialState: ReturnType<typeof useStore.getState>;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    initialState = useStore.getState();
    useStore.setState({ paletteOpen: false, tasks: [], canvases: [], bubbles: [] });
    trigger = document.createElement("button");
    trigger.textContent = "Open command center";
    document.body.append(trigger);
    trigger.focus();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    trigger.remove();
    useStore.setState(initialState, true);
    vi.unstubAllGlobals();
  });

  it("moves focus into the command center when it opens and traps Tab within the dialog", async () => {
    await act(async () => {
      root.render(<MemoryRouter><CommandPalette canvasId="canvas-1" onNewTask={() => {}} /></MemoryRouter>);
    });

    await act(async () => {
      useStore.getState().setPaletteOpen(true);
    });

    const dialog = container.querySelector('[role="dialog"]');
    const input = container.querySelector<HTMLInputElement>("input");
    const lastResult = [...container.querySelectorAll<HTMLButtonElement>("button")].at(-1)!;
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(input).toBe(document.activeElement);

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    });

    expect(document.activeElement).toBe(lastResult);

    await act(async () => {
      lastResult.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });

    expect(document.activeElement).toBe(input);
  });

  it("closes on Escape and restores the opening trigger or the canvas fallback", async () => {
    const fallback = document.createElement("button");
    fallback.textContent = "Canvas";
    document.body.append(fallback);
    const fallbackRef = createRef<HTMLButtonElement>();
    Object.defineProperty(fallbackRef, "current", { value: fallback });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <CommandPalette canvasId="canvas-1" onNewTask={() => {}} fallbackFocusRef={fallbackRef} />
        </MemoryRouter>,
      );
    });
    await act(async () => {
      useStore.getState().setPaletteOpen(true);
    });
    const input = container.querySelector<HTMLInputElement>("input");

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(useStore.getState().paletteOpen).toBe(false);
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
    await act(async () => {
      useStore.getState().setPaletteOpen(true);
    });
    await act(async () => {
      container.querySelector<HTMLInputElement>("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(document.activeElement).toBe(fallback);
    fallback.remove();
  });
});
