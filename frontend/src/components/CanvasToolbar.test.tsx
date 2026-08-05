// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useLocale } from "../i18n";
import { useStore } from "../store";
import { CanvasToolbar } from "./CanvasToolbar";

function renderToolbar() {
  return renderToStaticMarkup(
    <CanvasToolbar canvasId="canvas-1" onAddTask={() => {}} onOpenTimelapse={() => {}} onOpenPulse={() => {}} />,
  );
}

describe("CanvasToolbar information architecture", () => {
  beforeEach(() => {
    useLocale.setState({ locale: "en" });
    useStore.setState({ canvases: [], lens: "off", cardDensity: "full" });
  });

  it("keeps exactly the five canvas-scoped primary triggers", () => {
    const html = renderToolbar();

    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-label="Canvas toolbar"');
    expect(html).toContain('data-toolbar-primary="new-task"');
    expect(html).toContain('data-toolbar-primary="lens"');
    expect(html).toContain('data-toolbar-primary="view"');
    expect(html).toContain('data-toolbar-primary="arrange"');
    expect(html).toContain('data-toolbar-primary="tools"');
    expect((html.match(/data-toolbar-primary=/g) ?? [])).toHaveLength(5);
    // Global chrome (search/undo/visibility/language) lives in the TopBar.
    expect(html).not.toContain("data-topbar=");
  });

  describe("view menu", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
      container = document.createElement("div");
      document.body.append(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => root.unmount());
      container.remove();
    });

    it("offers mini cards and the table view without the old Ledger naming", async () => {
      await act(async () => {
        root.render(<CanvasToolbar canvasId="canvas-1" onAddTask={() => {}} onOpenTimelapse={() => {}} onOpenPulse={() => {}} />);
      });
      const trigger = container.querySelector<HTMLButtonElement>('[data-toolbar-primary="view"]');
      await act(async () => trigger?.click());

      expect(container.textContent).toContain("Table view");
      expect(container.textContent).toContain("Mini cards");
      expect(container.textContent).not.toContain("Ledger");
    });
  });
});
