import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanvasRouterLayout } from "./CanvasRouterLayout";

describe("CanvasRouterLayout", () => {
  const renderLayout = (spatialCommandCenterShell: boolean) => renderToStaticMarkup(
    <CanvasRouterLayout
      spatialCommandCenterShell={spatialCommandCenterShell}
      navigationLabel="Navigate"
      commandLabel="Global commands"
      railLabel="Workstreams"
      navigation={<div data-region="navigation">Boards</div>}
      commands={<div data-region="commands">Toolbar</div>}
      rail={<div data-region="rail">Workstreams</div>}
      overlays={<div data-region="overlays">Overlays</div>}
    >
      <div data-region="canvas">Canvas</div>
    </CanvasRouterLayout>,
  );

  it("uses the spatial command center shell only for an enabled flag", () => {
    const html = renderLayout(true);

    expect(html).toContain('class="command-center-shell command-center-shell--with-rail"');
    expect(html).toContain('class="command-center-shell__navigation" aria-label="Navigate"');
    expect(html).toContain('class="command-center-shell__commands" aria-label="Global commands"');
    expect(html).toContain('class="command-center-shell__main"');
    expect(html).toContain('class="command-center-shell__rail" aria-label="Workstreams"');
    expect(html).toContain('data-region="navigation"');
    expect(html).toContain('data-region="commands"');
    expect(html).toContain('data-region="canvas"');
    expect(html).toContain('data-region="rail"');
    expect(html).toContain('data-region="overlays"');
  });

  it.each([false, undefined, null, "invalid"])("preserves the legacy composition for a non-enabled flag (%s)", (spatialCommandCenterShell) => {
    const html = renderLayout(spatialCommandCenterShell as boolean);

    expect(html).toContain('class="flex h-screen w-screen overflow-hidden bg-[#0f0f13] text-gray-100 font-sans"');
    expect(html).not.toContain("command-center-shell");
    expect(html).toMatch(/<main class="flex-1 h-full overflow-hidden relative"><div data-region="commands">Toolbar<\/div><div data-region="canvas">Canvas<\/div><\/main>/);
    expect(html).toContain('data-region="overlays"');
  });
});
