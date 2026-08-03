// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NightCartographySurface } from "./NightCartography";

describe("NightCartographySurface semantics", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("gives Canvas a visible identity without adding a second landmark or heading", async () => {
    await act(async () => {
      root.render(<NightCartographySurface kind="canvas" title="Canvas"><div role="region" aria-label="Canvas" /></NightCartographySurface>);
    });

    const surface = container.querySelector<HTMLElement>("[data-workspace='canvas']");
    expect(surface).not.toBeNull();
    expect(surface?.getAttribute("aria-labelledby")).toBeNull();
    expect(surface?.querySelector("[data-workspace-label]")?.textContent).toBe("Canvas workspace");
    expect(surface?.querySelector("[data-workspace-title]")?.textContent).toBe("Canvas");
    expect(surface?.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
    expect(container.querySelectorAll('[role="region"][aria-label="Canvas"]')).toHaveLength(1);
  });

  it("leaves an existing focusable destination heading as the only destination heading", async () => {
    await act(async () => {
      root.render(<NightCartographySurface kind="ledger" title="Ledger"><h2 id="ledger-heading" tabIndex={-1}>Ledger</h2></NightCartographySurface>);
    });

    const surface = container.querySelector<HTMLElement>("[data-workspace='ledger']");
    expect(surface?.querySelector("[data-workspace-label]")?.textContent).toBe("Ledger workspace");
    expect(surface?.querySelectorAll("h1, h2, h3, h4, h5, h6")).toHaveLength(1);
    expect(surface?.querySelector<HTMLElement>("#ledger-heading")?.getAttribute("tabindex")).toBe("-1");
  });
});
