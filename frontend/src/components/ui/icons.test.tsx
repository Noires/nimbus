import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as icons from "./icons";

describe("ui/icons", () => {
  const iconComponents = Object.entries(icons).filter(([name]) => name !== "Icon") as Array<
    [string, (props: { size?: 16 | 20 }) => React.ReactElement]
  >;

  it("every icon is decorative and free of the 'form' substring", () => {
    for (const [name, Component] of iconComponents) {
      const html = renderToStaticMarkup(<Component />);
      expect(html, name).toContain('aria-hidden="true"');
      expect(html, name).not.toContain("form");
    }
  });

  it("supports the small size", () => {
    const html = renderToStaticMarkup(<icons.IconClose size={16} />);
    expect(html).toContain('width="16"');
    expect(html).toContain('viewBox="0 0 20 20"');
  });
});
