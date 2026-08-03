// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocale } from "../i18n";
import { COMMAND_CENTER_TUTORIAL_KEY, CommandCenterTutorial } from "./CommandCenterTutorial";

function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === label);
}

describe("CommandCenterTutorial interactions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.clear();
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

  it("persists resume progress and performs only local sample actions", async () => {
    const fetchSpy = vi.fn();
    const liveCanvasEscape = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    window.addEventListener("keydown", liveCanvasEscape);
    await act(async () => root.render(<CommandCenterTutorial open onClose={() => {}} />));

    await act(async () => button(container, "Next")?.click());
    expect(container.textContent).toContain("Capture an idea");
    expect(button(container, "Next")?.disabled).toBe(true);

    await act(async () => button(container, "Capture sample task")?.click());
    await act(async () => button(container, "Next")?.click());
    expect(container.textContent).toContain("Triage the sample Inbox");
    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => container.querySelector<HTMLElement>("[role=dialog]")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    window.removeEventListener("keydown", liveCanvasEscape);
    const saved = JSON.parse(localStorage.getItem(COMMAND_CENTER_TUTORIAL_KEY) ?? "{}");
    expect(saved).toMatchObject({ version: 5, status: "in-progress", step: 2, sample: { captured: true } });
    expect(liveCanvasEscape).not.toHaveBeenCalled();
  });

  it("resets the deterministic sample state and records a skipped tutorial", async () => {
    const statuses: string[] = [];
    await act(async () => root.render(<CommandCenterTutorial open onClose={() => {}} onStatusChange={(status) => statuses.push(status)} />));
    await act(async () => button(container, "Next")?.click());
    await act(async () => button(container, "Capture sample task")?.click());
    await act(async () => button(container, "Reset sample")?.click());

    expect(container.textContent).toContain("Welcome to your safe sample");
    expect(JSON.parse(localStorage.getItem(COMMAND_CENTER_TUTORIAL_KEY) ?? "{}")).toMatchObject({
      status: "in-progress", step: 0, sample: { captured: false, triaged: false, assigned: false, today: false, completed: false },
    });
    await act(async () => button(container, "Skip tutorial")?.click());
    expect(JSON.parse(localStorage.getItem(COMMAND_CENTER_TUTORIAL_KEY) ?? "{}")).toMatchObject({ status: "skipped" });
    expect(statuses).toEqual(["in-progress", "skipped"]);
  });

  it("keeps the exact sample checkpoint while switching language in the dialog", async () => {
    await act(async () => root.render(<CommandCenterTutorial open onClose={() => {}} />));
    await act(async () => button(container, "Next")?.click());
    await act(async () => button(container, "Capture sample task")?.click());
    await act(async () => button(container, "Deutsch")?.click());

    expect(container.textContent).toContain("Eine Idee erfassen");
    expect(JSON.parse(localStorage.getItem(COMMAND_CENTER_TUTORIAL_KEY) ?? "{}")).toMatchObject({
      version: 5, step: 1, sample: { captured: true, assigned: false },
    });
    expect(useLocale.getState().locale).toBe("en");
    expect(localStorage.getItem("locale")).toBeNull();
  });

  it("requires explicit sample-only Workstream and Review outcomes before advancing", async () => {
    await act(async () => root.render(<CommandCenterTutorial open onClose={() => {}} />));
    await act(async () => button(container, "Next")?.click());
    await act(async () => button(container, "Capture sample task")?.click());
    await act(async () => button(container, "Next")?.click());
    await act(async () => button(container, "Triage sample task")?.click());
    await act(async () => button(container, "Next")?.click());
    await act(async () => button(container, "Place sample task in Today")?.click());
    await act(async () => button(container, "Next")?.click());

    expect(container.textContent).toContain("See the Workstream");
    expect(button(container, "Next")?.disabled).toBe(true);
    await act(async () => button(container, "Inspect sample Workstream")?.click());
    expect(button(container, "Next")?.disabled).toBe(false);
    await act(async () => button(container, "Next")?.click());
    await act(async () => button(container, "Complete sample task")?.click());
    await act(async () => button(container, "Next")?.click());
    expect(button(container, "Open my workspace")?.disabled).toBe(true);
    await act(async () => button(container, "Inspect sample Review")?.click());
    expect(button(container, "Open my workspace")?.disabled).toBe(false);
    const saved = JSON.parse(localStorage.getItem(COMMAND_CENTER_TUTORIAL_KEY) ?? "{}");
    expect(saved.sample).toMatchObject({ workstreamInspected: true, reviewInspected: true });
  });

  it("keeps Shift+Tab from the programmatic heading inside the modal", async () => {
    await act(async () => root.render(<CommandCenterTutorial open onClose={() => {}} />));
    await act(async () => { await Promise.resolve(); });

    const heading = container.querySelector<HTMLHeadingElement>("#command-center-tutorial-title");
    const dialog = container.querySelector<HTMLElement>("[role=dialog]");
    expect(document.activeElement).toBe(heading);
    await act(async () => dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })));

    expect(dialog?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(button(container, "Next"));
  });
});
