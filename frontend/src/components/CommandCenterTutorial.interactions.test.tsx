// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocale } from "../i18n";
import { CommandCenterTutorial, COMMAND_CENTER_TUTORIAL_KEY } from "./CommandCenterTutorial";

const LEGACY_KEY = "nimbus:command-center-tutorial-v6";

function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === label);
}

function stubAnchor(className: string, attrs: Record<string, string> = {}) {
  const el = document.createElement("div");
  el.className = className;
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  Object.defineProperty(el, "getBoundingClientRect", {
    value: () => ({ top: 100, left: 100, width: 200, height: 80, right: 300, bottom: 180, x: 100, y: 100, toJSON: () => ({}) }),
  });
  document.body.append(el);
  return el;
}

describe("CommandCenterTutorial guided-tour interactions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let anchors: HTMLElement[];

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    useLocale.setState({ locale: "en" });
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    const surface = stubAnchor("night-cartography--canvas");
    const card = stubAnchor("task-card-stub", { "data-tour": "task-card" });
    anchors = [
      surface,
      card,
      stubAnchor("navigation-rail__button--capture"),
      stubAnchor("navigation-rail"),
      stubAnchor("canvas-toolbar"),
      stubAnchor("command-center-shell__rail"),
    ];
    const returnTarget = document.createElement("div");
    returnTarget.id = "command-center-tutorial-return";
    returnTarget.tabIndex = -1;
    document.body.append(returnTarget);
    anchors.push(returnTarget);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    for (const el of anchors) el.remove();
    vi.useRealTimers();
    localStorage.clear();
  });

  async function render(props: { open: boolean; replay?: boolean; onClose?: () => void; onStatusChange?: (s: string) => void }) {
    await act(async () => {
      root.render(
        <CommandCenterTutorial open={props.open} replay={props.replay} onClose={props.onClose ?? (() => {})} onStatusChange={props.onStatusChange} />,
      );
    });
  }

  async function settle() {
    await act(async () => { vi.advanceTimersByTime(400); });
  }

  it("walks through all steps and records completion in the new storage key", async () => {
    const statuses: string[] = [];
    await render({ open: true, onStatusChange: (s) => statuses.push(s) });
    await settle();

    expect(container.textContent).toContain("Welcome to Nimbus");
    const stepTitles = ["Your spatial canvas", "Capture ideas fast", "Destinations", "Canvas tools", "The tools rail", "You're ready"];
    for (const title of stepTitles) {
      await act(async () => button(container, "Next")?.click());
      await settle();
      expect(container.textContent).toContain(title);
    }
    await act(async () => button(container, "Finish tour")?.click());

    const stored = JSON.parse(localStorage.getItem(COMMAND_CENTER_TUTORIAL_KEY)!);
    expect(stored.status).toBe("completed");
    expect(statuses).toContain("completed");
  });

  it("supports Back and records Skip", async () => {
    await render({ open: true });
    await settle();
    await act(async () => button(container, "Next")?.click());
    await settle();
    expect(container.textContent).toContain("Your spatial canvas");
    await act(async () => button(container, "Back")?.click());
    await settle();
    expect(container.textContent).toContain("Welcome to Nimbus");

    await act(async () => button(container, "Skip tour")?.click());
    expect(JSON.parse(localStorage.getItem(COMMAND_CENTER_TUTORIAL_KEY)!).status).toBe("skipped");
  });

  it("keeps keyboard shortcuts local and resumes after Escape at the saved step", async () => {
    const windowSpy = vi.fn();
    window.addEventListener("keydown", windowSpy);
    const onClose = vi.fn();
    await render({ open: true, onClose });
    await settle();
    await act(async () => button(container, "Next")?.click());
    await settle();
    await act(async () => button(container, "Next")?.click());
    await settle();
    expect(container.textContent).toContain("Capture ideas fast");

    const dialog = container.querySelector<HTMLElement>(".guided-tour")!;
    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
      dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(windowSpy).not.toHaveBeenCalled();
    window.removeEventListener("keydown", windowSpy);
    expect(onClose).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(COMMAND_CENTER_TUTORIAL_KEY)!).status).toBe("in-progress");

    await render({ open: false });
    await render({ open: true });
    await settle();
    expect(container.textContent).toContain("Capture ideas fast");
  });

  it("falls back along the anchor chain and auto-skips missing steps", async () => {
    // Remove the rail anchor entirely: step 6 should auto-skip 5 -> 7.
    anchors.find((el) => el.className === "command-center-shell__rail")?.remove();
    await render({ open: true });
    await settle();
    for (let i = 0; i < 4; i++) {
      await act(async () => button(container, "Next")?.click());
      await settle();
    }
    expect(container.textContent).toContain("Canvas tools");
    await act(async () => button(container, "Next")?.click());
    await settle();
    await settle();
    expect(container.textContent).toContain("You're ready");
  });

  it("cleans up the legacy sample-modal checkpoint", async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ version: 6, status: "completed", step: 6, sample: {} }));
    await render({ open: true });
    await settle();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });
});
