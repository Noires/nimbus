// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocale } from "../i18n";
import { HelpPanel } from "./HelpPanel";
import { CommandCenterTutorial } from "./CommandCenterTutorial";

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
    await act(async () => root.render(<HelpPanel onClose={onClose} onStartTutorial={() => {}} />));
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

  it("hands replay focus to the tutorial and returns it to the command-center shell", async () => {
    const shell = document.createElement("main");
    shell.id = "command-center-tutorial-return";
    shell.tabIndex = -1;
    document.body.append(shell);
    const onClose = vi.fn();
    function Handoff() {
      const [helpOpen, setHelpOpen] = useState(true);
      const [tutorialOpen, setTutorialOpen] = useState(false);
      return <>
        {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} onStartTutorial={() => {
          setHelpOpen(false);
          setTutorialOpen(true);
        }} />}
        <CommandCenterTutorial open={tutorialOpen} replay onClose={() => {
          onClose();
          setTutorialOpen(false);
        }} />
      </>;
    }
    await act(async () => root.render(<Handoff />));
    const replay = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "Replay safe sample tutorial");
    await act(async () => replay?.click());
    await act(async () => { await Promise.resolve(); });

    expect(document.activeElement).toBe(container.querySelector("#command-center-tutorial-title"));
    const dialog = container.querySelector<HTMLElement>("[role=dialog]");
    await act(async () => dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(shell);
    shell.remove();
  });
});
