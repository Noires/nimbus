// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Canvas } from "../store";
import { useStore } from "../store";
import { useLocale } from "../i18n";
import { CanvasSwitcher } from "./CanvasSwitcher";

const canvases: Canvas[] = [
  { id: "canvas-1", name: "Alpha", createdAt: "2026-08-01T00:00:00.000Z" },
  { id: "canvas-2", name: "Beta", createdAt: "2026-08-02T00:00:00.000Z" },
];

describe("CanvasSwitcher", () => {
  let container: HTMLDivElement;
  let root: Root;
  let initialState: ReturnType<typeof useStore.getState>;
  const createCanvas = vi.fn(async (name: string) => ({ id: "canvas-new", name, createdAt: "" }));
  const renameCanvas = vi.fn(async () => {});
  const deleteCanvas = vi.fn(async () => {});
  const promptSpy = vi.fn();

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    useLocale.setState({ locale: "en" });
    initialState = useStore.getState();
    useStore.setState({ createCanvas, renameCanvas, deleteCanvas, canvases });
    createCanvas.mockClear();
    renameCanvas.mockClear();
    deleteCanvas.mockClear();
    vi.stubGlobal("prompt", promptSpy);
    vi.stubGlobal("confirm", promptSpy);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    useStore.setState(initialState, true);
  });

  async function render() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CanvasSwitcher canvases={canvases} canvasId="canvas-1" />
        </MemoryRouter>,
      );
    });
  }

  async function openPopover() {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]');
    await act(async () => trigger?.click());
  }

  it("creates a canvas from the inline form without window.prompt", async () => {
    await render();
    await openPopover();

    const input = container.querySelector<HTMLInputElement>('input[aria-label="New canvas name"]');
    expect(input).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "Gamma");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const submit = [...container.querySelectorAll("button")].find((b) => b.textContent === "Create canvas");
    await act(async () => submit?.click());

    expect(createCanvas).toHaveBeenCalledWith("Gamma");
    expect(promptSpy).not.toHaveBeenCalled();
  });

  it("renames inline and saves through the store", async () => {
    await render();
    await openPopover();

    const rename = container.querySelector<HTMLButtonElement>('[aria-label="Rename: Alpha"]');
    await act(async () => rename?.click());
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Canvas name"]');
    expect(input?.value).toBe("Alpha");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "Alpha 2");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = [...container.querySelectorAll("button")].find((b) => b.textContent === "Save");
    await act(async () => save?.click());

    expect(renameCanvas).toHaveBeenCalledWith("canvas-1", "Alpha 2");
    expect(promptSpy).not.toHaveBeenCalled();
  });

  it("deletes only after the alertdialog confirmation", async () => {
    await render();
    await openPopover();

    const del = container.querySelector<HTMLButtonElement>('[aria-label="Delete: Beta"]');
    await act(async () => del?.click());

    const dialog = container.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(deleteCanvas).not.toHaveBeenCalled();

    const confirmButton = [...container.querySelectorAll("button")].find((b) => b.textContent === "Delete canvas");
    await act(async () => confirmButton?.click());

    expect(deleteCanvas).toHaveBeenCalledWith("canvas-2");
    expect(promptSpy).not.toHaveBeenCalled();
  });
});
