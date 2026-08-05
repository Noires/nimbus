import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { useLocale } from "../i18n";
import { NavigationRail } from "./NavigationRail";

describe("NavigationRail", () => {
  beforeEach(() => {
    useLocale.setState({ locale: "en" });
  });

  it("renders the six destinations plus capture with accessible labels", () => {
    const html = renderToStaticMarkup(
      <NavigationRail canvasId="canvas-1" destination="today" inboxCount={3} onNavigate={() => {}} onCapture={() => {}} />,
    );

    expect((html.match(/<button/g) ?? [])).toHaveLength(7);
    expect(html).toContain('aria-label="Canvas"');
    expect(html).toContain('aria-label="Today / Focus"');
    expect(html).toContain('aria-label="Inbox (3)"');
    expect(html).toContain('aria-label="Review"');
    expect(html).toContain('aria-label="Operations"');
    expect(html).toContain('aria-label="Ledger"');
    expect(html).toContain('aria-label="Capture"');
    // Active destination is exposed via aria-pressed.
    expect(html).toContain('aria-pressed="true"');
    // Every button offers a tooltip label.
    expect((html.match(/title="/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it("renders nothing without a canvas", () => {
    const html = renderToStaticMarkup(
      <NavigationRail canvasId={null} destination="canvas" inboxCount={0} onNavigate={() => {}} onCapture={() => {}} />,
    );
    expect(html).toBe("");
  });
});
