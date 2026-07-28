import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpatialCommandCenterShell } from "./SpatialCommandCenterShell";

describe("SpatialCommandCenterShell", () => {
  it("renders landmarked navigation, command, main, and optional contextual rail regions", () => {
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

    expect(html).toContain('<aside class="command-center-shell__navigation" aria-label="Boards">');
    expect(html).toContain('<header class="command-center-shell__commands" aria-label="Global commands">');
    expect(html).toContain('<main class="command-center-shell__main">');
    expect(html).toContain('<aside class="command-center-shell__rail" aria-label="Context">');
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
