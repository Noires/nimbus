import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DensitySelector } from "./DensitySelector";

describe("DensitySelector", () => {
  it("renders an accessible three-mode selector with an announced current state", () => {
    const html = renderToStaticMarkup(<DensitySelector density="high" onChange={() => {}} />);

    expect(html).toContain('aria-label="Card density"');
    expect(html).toContain('value="high"');
    expect(html).toContain("Normal");
    expect(html).toContain("Compact");
    expect(html).toContain("High density");
    expect(html).toContain('role="status"');
    expect(html).toContain("High density: titles and essential state");
  });
});
