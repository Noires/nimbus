import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { history } from "../engine/history";
import { useLocale } from "../i18n";
import { useStore } from "../store";
import { Toolbar } from "./Toolbar";

function renderToolbar() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <Toolbar canvasId="canvas-1" onAddTask={() => {}} onOpenTimelapse={() => {}} onOpenPulse={() => {}} />
    </MemoryRouter>,
  );
}

describe("Toolbar information architecture", () => {
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
      lens: "off",
      liveConnected: false,
    });
  });

  it("keeps exactly the six approved primary controls visible", () => {
    const html = renderToolbar();

    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-label="Canvas toolbar"');
    expect(html).not.toContain('<section aria-label="Canvas toolbar"');
    expect(html).toContain('data-toolbar-primary="new-task"');
    expect(html).toContain('data-toolbar-primary="search"');
    expect(html).toContain('data-toolbar-primary="lens"');
    expect(html).toContain('data-toolbar-primary="visibility"');
    expect(html).toContain('data-toolbar-primary="undo"');
    expect(html).toContain('data-toolbar-primary="view"');
    expect((html.match(/data-toolbar-primary=/g) ?? [])).toHaveLength(6);
  });

  it("uses global completed and archived visibility labels rather than task actions", () => {
    const html = renderToolbar();

    expect(html).toContain("Show completed");
    expect(html).toContain("Show archived");
    expect(html).not.toContain(">Done<");
    expect(html).not.toContain(">Arch<");
  });

  it("places redo in the More menu when redo history exists", () => {
    history.push({ op: { kind: "batch", ops: [] }, label: "test" });
    void useStore.getState().undo();

    const html = renderToolbar();

    expect(html).toContain('data-toolbar-secondary="more"');
    expect(html).toContain('data-redo-available="true"');
    expect(html).not.toContain('data-toolbar-primary="redo"');
  });

});
