import { useCallback, useEffect, useState } from "react";

export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Resolves an ordered selector list to the first matching element and its
 * viewport rect. Re-measures on selector change (double rAF so framer/CSS
 * entrance animations settle), on window resize, and once more after ~300ms —
 * the workspace rail slides in over .22s. A zero-sized rect is reported as
 * null so callers can fall back to a centered layout (also covers jsdom). */
export function useAnchorRect(selectors: string[] | null): { rect: AnchorRect | null; remeasure: () => void } {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  const measure = useCallback(() => {
    if (!selectors || selectors.length === 0 || typeof document === "undefined") {
      setRect(null);
      return;
    }
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const box = element.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) {
        setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
        return;
      }
    }
    setRect(null);
  }, [selectors]);

  useEffect(() => {
    let cancelled = false;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) measure(); }));
    const late = setTimeout(() => { if (!cancelled) measure(); }, 300);
    measure();
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(late);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return { rect, remeasure: measure };
}
