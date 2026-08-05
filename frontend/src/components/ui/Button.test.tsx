import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonClassNames } from "./Button";

describe("ui/Button", () => {
  it("defaults to type=button and renders children as sole content", () => {
    const html = renderToStaticMarkup(<Button variant="ghost" size="sm">Reveal</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain(">Reveal</button>");
  });

  it("never emits a class containing the substring 'form'", () => {
    // OperationsView's markup contract bans the substring "form" anywhere —
    // this guards every variant and size against e.g. `transform` classes.
    for (const classes of [...Object.values(buttonClassNames.variants), ...Object.values(buttonClassNames.sizes)]) {
      expect(classes).not.toContain("form");
    }
    const html = renderToStaticMarkup(<Button variant="accent" size="md" className="extra">x</Button>);
    expect(html.match(/class="([^"]*)"/)![1]).not.toContain("form");
  });

  it("appends className passthrough", () => {
    const html = renderToStaticMarkup(<Button className="mobile-operations__actions">x</Button>);
    expect(html).toContain("mobile-operations__actions");
  });
});
