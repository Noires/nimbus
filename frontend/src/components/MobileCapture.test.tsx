import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MobileCapture, submitMobileCapture } from "./MobileCapture";

describe("submitMobileCapture", () => {
  it("submits the original non-empty input and reports success after the capture confirms", async () => {
    const capture = vi.fn(async () => {});

    await expect(submitMobileCapture("  Fix login tomorrow #auth  ", capture)).resolves.toBe("success");
    expect(capture).toHaveBeenCalledWith("  Fix login tomorrow #auth  ");
  });

  it("does not submit blank input", async () => {
    const capture = vi.fn(async () => {});

    await expect(submitMobileCapture("   ", capture)).resolves.toBe("empty");
    expect(capture).not.toHaveBeenCalled();
  });

  it("reports a rejected capture without discarding the caller's input", async () => {
    const capture = vi.fn(async () => { throw new Error("offline"); });

    await expect(submitMobileCapture("Keep this task", capture)).resolves.toBe("failed");
    expect(capture).toHaveBeenCalledWith("Keep this task");
  });
});

describe("MobileCapture", () => {
  it("marks its input and submit controls as explicit mobile touch targets", () => {
    const html = renderToStaticMarkup(<MobileCapture onCapture={async () => {}} />);

    expect(html).toContain('class="mobile-capture__input"');
    expect(html).toContain('class="mobile-capture__submit"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('mobile-capture__hint');
  });
});
