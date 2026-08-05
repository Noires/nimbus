// @ts-ignore -- Vitest runs in Node, while the production compiler excludes Node ambient types.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("../global.css", import.meta.url), "utf8");

describe("command-center shell responsive layout", () => {
  it("uses a modal overlay for the compact rail so the work area retains both grid columns", () => {
    const compactDesktop = stylesheet.match(/@media \(min-width: 769px\) and \(max-width: 1100px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

    expect(compactDesktop).toContain("grid-template-columns: 3.5rem minmax(0, 1fr);");
    expect(compactDesktop).toMatch(/\.command-center-shell__rail-backdrop\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;/);
    expect(compactDesktop).toMatch(/\.command-center-shell__rail\[role="dialog"\]\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?width:\s*min\(22rem, 88vw\);/);
  });

  it("keeps the optional no-rail shell in two explicit columns while sharing the header only when the rail exists", () => {
    expect(stylesheet).toMatch(/\.command-center-shell__commands\s*\{[^}]*grid-column:\s*2;[^}]*min-height:\s*3rem;/s);
    expect(stylesheet).toMatch(/\.command-center-shell--with-rail \.command-center-shell__commands\s*\{\s*grid-column:\s*2 \/ 4;\s*\}/);
    expect(stylesheet).toMatch(/@media \(min-width: 769px\) and \(max-width: 1100px\) \{[\s\S]*?\.command-center-shell--with-rail \.command-center-shell__commands\s*\{\s*grid-column:\s*2;\s*\}/);
  });

  it("keeps the command row slim — canvas tools float over the field instead", () => {
    // Global chrome only: one slim row; no compact-desktop height override
    // remains because the canvas toolbar no longer lives inside the band.
    expect(stylesheet).toMatch(/\.command-center-shell__commands\s*\{[^}]*min-height:\s*3rem;/s);
    expect(stylesheet).not.toMatch(/@media \(min-width: 769px\) and \(max-width: 1100px\) \{[\s\S]*?\.command-center-shell__commands\s*\{\s*min-height:/);
    expect(stylesheet).toMatch(/\.command-center-shell__main\s*\{[^}]*grid-row:\s*2;/s);
  });

  it("does not add a mobile shell reflow because the mobile companion owns the route", () => {
    expect(stylesheet).not.toMatch(/@media \(max-width: 768px\) \{\s*\.command-center-shell\s*\{/);
  });
});
