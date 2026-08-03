import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { useLocale } from "../i18n";
import { HelpPanel } from "./HelpPanel";

describe("HelpPanel Inbox copy", () => {
  afterEach(() => useLocale.setState({ locale: "en" }));

  it("describes Inbox triage controls in the universal Command Center", () => {
    useLocale.setState({ locale: "en" });

    const html = renderToStaticMarkup(<HelpPanel onClose={() => {}} />);

    expect(html).toContain("Use Inbox triage to set priority, due date, workstream, or move a task out when it is ready.");
    expect(html).not.toContain("Drag a card from the Inbox dock onto the canvas to place it.");
  });
});
