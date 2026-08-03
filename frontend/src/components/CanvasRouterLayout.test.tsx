import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanvasRouterLayout } from "./CanvasRouterLayout";

describe("CanvasRouterLayout", () => {
  const renderLayout = () => renderToStaticMarkup(
    <CanvasRouterLayout
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

  it("always uses the Command Center shell without an opt-in prop", () => {
    const html = renderLayout();

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
});
