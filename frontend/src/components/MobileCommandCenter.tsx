import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useT } from "../i18n";
import type { MobileCommandDestination } from "./mobileCommandDestination";

interface MobileCommandCenterProps {
  destination: MobileCommandDestination;
  onDestinationChange: (destination: Extract<MobileCommandDestination, "today" | "inbox" | "canvas" | "more">) => void;
  onClose: () => void;
  onCapture: () => void;
  children: ReactNode;
}

const destinations: ReadonlyArray<Extract<MobileCommandDestination, "today" | "inbox" | "canvas" | "more">> = [
  "today",
  "inbox",
  "canvas",
  "more",
];

export function MobileCommandCenter({
  destination,
  onDestinationChange,
  onClose,
  onCapture,
  children,
}: MobileCommandCenterProps) {
  const t = useT();
  const contentLabel = destination === "inspector" ? t("inspector.label") : t(`mobile.command.${destination}`);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Capture hands focus to its text field; every routed surface starts at its heading.
    if (destination !== "capture") titleRef.current?.focus();
  }, [destination]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    // Keep Escape local to the companion: it closes this surface but must not
    // also trigger CanvasRouter's productive-canvas shortcuts.
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <section id="command-center-tutorial-return" className="mobile-command-center" tabIndex={-1} onKeyDown={handleKeyDown}>
      <header className="mobile-command-center__header nc-chart-wash">
        <h1 ref={titleRef} tabIndex={-1} className="mobile-command-center__title">{contentLabel}</h1>
        <div className="mobile-command-center__header-actions">
          <button type="button" onClick={onCapture} aria-label={t("mobile.command.capture")} className="mobile-command-center__capture">
            + {t("mobile.command.capture")}
          </button>
          <button type="button" onClick={onClose} aria-label={t("mobile.command.close")} className="mobile-command-center__close">
            {t("mobile.command.close")}
          </button>
        </div>
      </header>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{contentLabel}</p>
      <main className="mobile-command-center__content" aria-label={contentLabel}>
        {children}
      </main>
      <nav aria-label={t("mobile.command.label")} className="mobile-command-center__nav">
        {destinations.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onDestinationChange(item)}
            aria-current={destination === item ? "page" : undefined}
            className="mobile-command-center__nav-button"
          >
            {t(`mobile.command.${item}`)}
          </button>
        ))}
      </nav>
    </section>
  );
}
