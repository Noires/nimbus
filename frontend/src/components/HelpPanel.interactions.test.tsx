// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocale } from "../i18n";
import { HelpPanel } from "./HelpPanel";

describe("HelpPanel dialog behavior", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    useLocale.setState({ locale: "en" });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("is a labelled modal, traps focus, closes on Escape, and returns focus", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const onClose = vi.fn();
    await act(async () => root.render(<HelpPanel spatialCommandCenterShell onClose={onClose} onStartTutorial={() => {}} />));
    await act(async () => { await Promise.resolve(); });

    const dialog = container.querySelector<HTMLElement>("[role=dialog]");
    const close = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.getAttribute("aria-label") === "Close");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("help-panel-title");
    expect(document.activeElement).toBe(close);

    await act(async () => dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })));
    expect(dialog?.contains(document.activeElement)).toBe(true);
    await act(async () => dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(onClose).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
