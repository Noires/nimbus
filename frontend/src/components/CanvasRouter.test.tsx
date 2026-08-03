import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveRailLabel } from "./CanvasRouter";
import { CanvasRouterLayout } from "./CanvasRouterLayout";
import { useLocale } from "../i18n";

describe("resolveRailLabel", () => {
  it("uses the localized Review label for the outer rail while review is open", () => {
    const html = renderToStaticMarkup(
      <CanvasRouterLayout
        navigationLabel="Navigation"
        commandLabel="Commands"
        railLabel={resolveRailLabel({ reviewRailOpen: true, todayFocusOpen: false, inboxTriageOpen: false })}
        navigation={null}
        commands={null}
        rail={<div />}
        overlays={null}
      >
        <div />
      </CanvasRouterLayout>,
    );

    expect(html).toContain('class="command-center-shell__rail" aria-label="Review"');
  });

  it("uses the active locale for the outer review rail label", () => {
    const previousLocale = useLocale.getState().locale;
    useLocale.setState({ locale: "de" });

    try {
      expect(resolveRailLabel({ reviewRailOpen: true, todayFocusOpen: true, inboxTriageOpen: true })).toBe("Review");
    } finally {
      useLocale.setState({ locale: previousLocale });
    }
  });

  it("names Operations when that explicit Command Center destination is active", () => {
    expect(resolveRailLabel({ reviewRailOpen: false, todayFocusOpen: false, inboxTriageOpen: false, operationsOpen: true })).toBe("Operations");
  });

  it("renders an explicit localized rail close action when a compact rail is open", () => {
    const html = renderToStaticMarkup(
      <CanvasRouterLayout
        navigationLabel="Navigation"
        commandLabel="Commands"
        railLabel="Operations"
        closeRailLabel="Close panel"
        onCloseRail={() => undefined}
        navigation={null}
        commands={null}
        rail={<div />}
        overlays={null}
      >
        <div />
      </CanvasRouterLayout>,
    );

    expect(html).toContain("Close panel");
    expect(html).toContain("command-center-shell__rail-close");
  });
});
