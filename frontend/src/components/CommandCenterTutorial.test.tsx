import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { useLocale } from "../i18n";
import { CommandCenterTutorial } from "./CommandCenterTutorial";

describe("CommandCenterTutorial (guided tour)", () => {
  beforeEach(() => {
    useLocale.setState({ locale: "en" });
  });

  it("renders the welcome step as a centered dialog with the read-only promise", () => {
    const html = renderToStaticMarkup(<CommandCenterTutorial open onClose={() => {}} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain("Guided tour");
    expect(html).toContain("Welcome to Nimbus");
    expect(html).toContain("Step 1 of 7");
    expect(html).toContain("Nothing is read or changed.");
    expect(html).toContain("Skip tour");
    expect(html).toContain("Next");
    // No Back on the first step.
    expect(html).not.toContain(">Back<");
  });

  it("renders German copy without English fallback", () => {
    useLocale.setState({ locale: "de" });
    const html = renderToStaticMarkup(<CommandCenterTutorial open onClose={() => {}} />);

    expect(html).toContain("Willkommen bei Nimbus");
    expect(html).toContain("Schritt 1 von 7");
    expect(html).toContain("Nichts wird gelesen oder verändert.");
    expect(html).toContain("Tour überspringen");
  });

  it("renders nothing when closed", () => {
    expect(renderToStaticMarkup(<CommandCenterTutorial open={false} onClose={() => {}} />)).toBe("");
  });
});
