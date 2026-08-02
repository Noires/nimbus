import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { useLocale } from "../i18n";
import { CommandCenterTutorial } from "./CommandCenterTutorial";

describe("CommandCenterTutorial", () => {
  afterEach(() => useLocale.setState({ locale: "en" }));

  it("renders an explicitly isolated sample workflow without production data hooks", () => {
    const html = renderToStaticMarkup(<CommandCenterTutorial open onClose={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Tutorial sample Canvas");
    expect(html).toContain("No real Nimbus data is displayed or changed.");
    expect(html).toContain("Step 1 of 7");
    expect(html).toContain("Reset sample");
  });

  it("renders complete German copy rather than falling back to English", () => {
    useLocale.setState({ locale: "de" });
    const html = renderToStaticMarkup(<CommandCenterTutorial open onClose={() => {}} />);
    expect(html).toContain("Beispiel-Canvas des Tutorials");
    expect(html).toContain("Schritt 1 von 7");
    expect(html).toContain("Es werden keine echten Nimbus-Daten gezeigt oder verändert.");
  });
});