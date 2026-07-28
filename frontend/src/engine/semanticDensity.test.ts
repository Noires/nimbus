import { describe, expect, it } from "vitest";
import { resolveSemanticDensity } from "./semanticDensity";

describe("resolveSemanticDensity", () => {
  it("keeps normal density at the existing full-card zoom threshold", () => {
    expect(resolveSemanticDensity("normal", 0.5)).toMatchObject({ lod: "full", scale: 1, disclose: "full", titleVisible: true });
    expect(resolveSemanticDensity("normal", 0.4)).toMatchObject({ lod: "chip", disclose: "summary" });
  });

  it("progressively reduces metadata while retaining a readable title", () => {
    expect(resolveSemanticDensity("compact", 1)).toMatchObject({ lod: "full", scale: 0.9, disclose: "summary", titleVisible: true });
    expect(resolveSemanticDensity("high", 1)).toMatchObject({ lod: "full", scale: 0.8, disclose: "essential", titleVisible: true });
    expect(resolveSemanticDensity("high", 0.4)).toMatchObject({ lod: "chip", titleVisible: true });
  });

  it("keeps titles available in every density mode", () => {
    expect(resolveSemanticDensity("normal", 0.2)).toMatchObject({ lod: "dot", titleVisible: true });
    expect(resolveSemanticDensity("high", 0.2)).toMatchObject({ lod: "dot", titleVisible: true });
  });
});
