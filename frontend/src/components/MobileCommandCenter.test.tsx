import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MobileCommandCenter } from "./MobileCommandCenter";

describe("MobileCommandCenter", () => {
  it("renders the four operational tabs and an app-bar Capture control", () => {
    const html = renderToStaticMarkup(
      <MobileCommandCenter destination="inbox" onDestinationChange={() => {}} onCapture={() => {}} onClose={() => {}}>
        <p>Inbox content</p>
      </MobileCommandCenter>,
    );

    expect(html).toContain('<nav aria-label="Mobile command center" class="mobile-command-center__nav">');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("+ Capture");
    expect(html).toContain(">Inbox<");
    expect(html).toContain(">Today<");
    expect(html).toContain(">Canvas<");
    expect(html).toContain(">More<");
    expect(html).not.toContain('hidden=""');
    expect(html).not.toContain(">Review<");
    expect(html).not.toContain(">Operations<");
    expect(html).toContain('<main class="mobile-command-center__content" aria-label="Inbox">');
    expect(html).toContain('aria-label="Close mobile command center"');
    expect(html).toContain("Inbox content");
  });
});
