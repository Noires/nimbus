import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

function Probe({ fallback }: { fallback: boolean }) {
  return <output>{String(useMediaQuery("(max-width: 768px)", fallback))}</output>;
}

describe("useMediaQuery", () => {
  it("uses the supplied fallback during server rendering without reading window", () => {
    expect(renderToStaticMarkup(<Probe fallback={false} />)).toBe("<output>false</output>");
    expect(renderToStaticMarkup(<Probe fallback />)).toBe("<output>true</output>");
  });
});
