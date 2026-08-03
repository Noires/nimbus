// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpatialCommandCenterShell } from "./SpatialCommandCenterShell";

describe("SpatialCommandCenterShell", () => {
  it("renders header, primary, and secondary regions in reading order while retaining navigation", () => {
    const html = renderToStaticMarkup(
      <SpatialCommandCenterShell
        navigationLabel="Boards"
        commandLabel="Global commands"
        railLabel="Context"
        navigation={<a href="/canvas/demo">Demo</a>}
        commands={<button type="button">Add task</button>}
        rail={<p>Contextual detail</p>}
      >
        <div>Canvas content</div>
      </SpatialCommandCenterShell>,
    );

    const header = html.indexOf('<header class="command-center-shell__commands" aria-label="Global commands">');
    const primary = html.indexOf('<main class="command-center-shell__main">');
    const secondary = html.indexOf('<aside class="command-center-shell__rail" aria-label="Context">');

    expect(header).toBeGreaterThanOrEqual(0);
    expect(primary).toBeGreaterThan(header);
    expect(secondary).toBeGreaterThan(primary);
    expect(html).toContain('<aside class="command-center-shell__navigation" aria-label="Boards">');
    expect(html).toContain("Canvas content");
  });

  it("lets a destination use the full primary workspace while its Inspector remains contextual", () => {
    const html = renderToStaticMarkup(
      <SpatialCommandCenterShell navigationLabel="Boards" commandLabel="Commands" navigation={<div>Navigation</div>} commands={<div>Commands</div>} rail={<div>Inspector</div>} fullWidth>
        <div>Inbox workspace</div>
      </SpatialCommandCenterShell>,
    );

    expect(html).toContain('class="command-center-shell command-center-shell--with-rail command-center-shell--workspace"');
    expect(html).toContain("Inbox workspace");
    expect(html).toContain('aria-label="Context"');
  });

  it("omits the contextual rail when no contextual content is supplied", () => {
    const html = renderToStaticMarkup(
      <SpatialCommandCenterShell
        navigationLabel="Boards"
        commandLabel="Global commands"
        navigation={<div>Navigation</div>}
        commands={<div>Commands</div>}
      >
        <div>Canvas content</div>
      </SpatialCommandCenterShell>,
    );

    expect(html).not.toContain("command-center-shell__rail");
  });

  it("renders a compact contextual rail as an explicit modal overlay with a backdrop", () => {
    const html = renderToStaticMarkup(
      <SpatialCommandCenterShell
        navigationLabel="Boards"
        commandLabel="Global commands"
        railLabel="Utilities"
        closeRailLabel="Close utilities"
        onCloseRail={() => {}}
        railModal
        navigation={<div>Navigation</div>}
        commands={<div>Commands</div>}
        rail={<div>Utilities</div>}
      >
        <div>Inbox workspace</div>
      </SpatialCommandCenterShell>,
    );

    expect(html).toContain('class="command-center-shell__rail-backdrop"');
    expect(html).toContain('class="command-center-shell__rail" role="dialog" aria-modal="true" aria-label="Utilities"');
    expect(html).toContain('aria-label="Close utilities"');
  });
});

describe("compact modal rail", () => {
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

  it("traps focus, closes on Escape, and restores focus to the Utilities opener", async () => {
    const close = vi.fn();
    await act(async () => {
      root.render(
        <SpatialCommandCenterShell
          navigationLabel="Boards"
          commandLabel="Global commands"
          railLabel="Utilities"
          closeRailLabel="Close utilities"
          openRailLabel="Utilities"
          railModal
          railToggle
          onCloseRail={close}
          navigation={<div>Navigation</div>}
          commands={<div>Commands</div>}
          rail={<><button type="button">First utility</button><button type="button">Last utility</button></>}
        >
          <div>Workspace</div>
        </SpatialCommandCenterShell>,
      );
    });

    const opener = container.querySelector<HTMLButtonElement>(".command-center-shell__rail-open")!;
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const closeButton = dialog.querySelector<HTMLButtonElement>(".command-center-shell__rail-close")!;
    expect(document.activeElement).toBe(closeButton);

    await act(async () => closeButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })));
    expect(document.activeElement?.textContent).toBe("First utility");
    await act(async () => closeButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });
});
