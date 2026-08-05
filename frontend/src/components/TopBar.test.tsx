import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { history } from "../engine/history";
import { useLocale } from "../i18n";
import { useStore } from "../store";
import { TopBar } from "./TopBar";

function renderTopBar(canvasId: string | null = "canvas-1") {
  return renderToStaticMarkup(
    <MemoryRouter>
      <TopBar canvasId={canvasId} />
    </MemoryRouter>,
  );
}

describe("TopBar information architecture", () => {
  beforeEach(() => {
    history.clear();
    useLocale.setState({ locale: "en" });
    useStore.setState({
      tasks: [],
      canvases: [],
      bubbles: [],
      connections: [],
      showDone: false,
      showArchived: false,
      searchQuery: "",
      liveConnected: false,
    });
  });

  it("carries exactly the global controls", () => {
    const html = renderTopBar();

    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-label="Global commands"');
    expect(html).toContain('data-topbar="search"');
    expect(html).toContain('data-topbar="visibility"');
    expect(html).toContain('data-topbar="undo"');
    expect(html).toContain('data-topbar="language"');
    expect(html).toContain('data-topbar="more"');
    expect((html.match(/data-topbar=/g) ?? [])).toHaveLength(5);
    // Canvas-scoped triggers must not leak into the global bar.
    expect(html).not.toContain("data-toolbar-primary=");
  });

  it("uses global completed and archived visibility labels", () => {
    const html = renderTopBar();

    expect(html).toContain("Show completed");
    expect(html).toContain("Show archived");
  });

  it("places redo in the More menu when redo history exists", () => {
    history.push({ op: { kind: "batch", ops: [] }, label: "test" });
    void useStore.getState().undo();

    const html = renderTopBar();

    expect(html).toContain('data-topbar="more"');
    expect(html).toContain('data-redo-available="true"');
  });
});
