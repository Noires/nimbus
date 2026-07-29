import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MobileCommandCenter } from "./MobileCommandCenter";

describe("MobileCommandCenter", () => {
  it("renders labelled mobile navigation with one current destination and an accessible close control", () => {
    const html = renderToStaticMarkup(
      <MobileCommandCenter destination="inbox" onDestinationChange={() => {}} onClose={() => {}}>
        <p>Inbox content</p>
      </MobileCommandCenter>,
    );

    expect(html).toContain('<nav aria-label="Mobile command center" class="mobile-command-center__nav">');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(">Capture<");
    expect(html).toContain(">Inbox<");
    expect(html).toContain(">Today<");
    expect(html).toContain(">Review<");
    expect(html).toContain(">Operations<");
    expect(html).toContain(">More<");
    expect(html).toContain('<main class="mobile-command-center__content" aria-label="Inbox">');
    expect(html).toContain('aria-label="Close mobile command center"');
    expect(html).toContain("Inbox content");
  });
});
