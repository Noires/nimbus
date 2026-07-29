// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Canvas } from "./Canvas";

describe("Canvas accessibility", () => {
  it("identifies the spatial board as a focusable labeled region without listbox semantics", () => {
    const html = renderToStaticMarkup(
      <Canvas canvasId="canvas-1" semanticDensity="normal" onCreateAt={() => {}} onEditTask={() => {}} />,
    );

    expect(html).toMatch(/role="region"/);
    expect(html).toMatch(/aria-label="Canvas"/);
    expect(html).toMatch(/tabindex="-1"/);
    expect(html).not.toMatch(/role="listbox"/);
  });
});
