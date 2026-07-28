import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { useLocale } from "../i18n";
import { HelpPanel } from "./HelpPanel";

describe("HelpPanel Inbox copy", () => {
  afterEach(() => useLocale.setState({ locale: "en" }));

  it("describes dragging a legacy InboxDock card onto the canvas when the command-center flag is off", () => {
    useLocale.setState({ locale: "en" });

    const html = renderToStaticMarkup(<HelpPanel spatialCommandCenterShell={false} onClose={() => {}} />);

    expect(html).toContain("Drag a card from the Inbox dock onto the canvas to place it.");
    expect(html).not.toContain("Use Inbox triage to set priority");
  });

  it("describes Inbox triage controls when the command-center flag is on", () => {
    useLocale.setState({ locale: "en" });

    const html = renderToStaticMarkup(<HelpPanel spatialCommandCenterShell onClose={() => {}} />);

    expect(html).toContain("Use Inbox triage to set priority, due date, workstream, or move a task out when it is ready.");
    expect(html).not.toContain("Drag a card from the Inbox dock onto the canvas to place it.");
  });
});
