import type { ReactNode } from "react";
import { useT } from "../i18n";
import type { MobileCommandDestination } from "./mobileCommandCenter";

interface MobileCommandCenterProps {
  destination: MobileCommandDestination;
  onDestinationChange: (destination: MobileCommandDestination) => void;
  onClose: () => void;
  children: ReactNode;
}

const destinations: ReadonlyArray<Exclude<MobileCommandDestination, "inspector">> = [
  "capture",
  "inbox",
  "today",
  "review",
  "more",
];

export function MobileCommandCenter({
  destination,
  onDestinationChange,
  onClose,
  children,
}: MobileCommandCenterProps) {
  const t = useT();
  const contentLabel = destination === "inspector" ? t("inspector.label") : t(`mobile.command.${destination}`);

  return (
    <section className="mobile-command-center">
      <header className="mobile-command-center__header">
        <h1 className="mobile-command-center__title">{contentLabel}</h1>
        <button type="button" onClick={onClose} aria-label={t("mobile.command.close")} className="mobile-command-center__close">
          {t("mobile.command.close")}
        </button>
      </header>
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
