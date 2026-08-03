import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
});
