import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { railGlide } from "../utils/motion";
import { useT } from "../i18n";
import type { CanvasDestination } from "./destinationRoutes";
import { Icon, IconPlus } from "./ui/icons";

interface NavigationRailProps {
  canvasId: string | null;
  destination: CanvasDestination;
  inboxCount: number;
  onNavigate: (destination: CanvasDestination) => void;
  onCapture: () => void;
}

const ICONS: Record<CanvasDestination, ReactNode> = {
  canvas: <Icon><circle cx="6" cy="6" r="2.4" /><circle cx="14.5" cy="9" r="2" /><circle cx="8.5" cy="14.5" r="1.8" /><path d="M8 7.3 12.7 8.4M13.4 10.8l-3.5 2.3" /></Icon>,
  today: <Icon><circle cx="10" cy="10" r="6.5" /><circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" /></Icon>,
  inbox: <Icon><path d="M3 11.5V15a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 17 15v-3.5" /><path d="M3 11.5h4l1.3 2h3.4l1.3-2h4" /><path d="M10 3.5v6M7.5 7.5 10 10l2.5-2.5" /></Icon>,
  review: <Icon><path d="M16.5 10a6.5 6.5 0 1 1-2-4.7" /><path d="M16.8 3.6v3.6h-3.6" /><path d="m7.5 10 1.8 1.8L12.8 8" /></Icon>,
  operations: <Icon><path d="M3 10.5h3l2-5 3.5 9 2-4h3.5" /></Icon>,
  ledger: <Icon><path d="M4 5.5h12M4 10h12M4 14.5h8" /></Icon>,
};

/** Slim icon rail: the six destinations plus the capture action. Labels stay
 * available to screen readers and as tooltips; the canvas list moved into the
 * TopBar canvas switcher. The active pill glides between destinations via a
 * shared-layout animation (static under prefers-reduced-motion). */
export function NavigationRail({ canvasId, destination, inboxCount, onNavigate, onCapture }: NavigationRailProps) {
  const t = useT();
  const reduced = useReducedMotion();
  if (!canvasId) return null;

  const items: Array<{ key: CanvasDestination; label: string }> = [
    { key: "canvas", label: t("d.shell.canvas") },
    { key: "today", label: t("today.title") },
    { key: "inbox", label: t("inbox.triage.title") },
    { key: "review", label: t("review.title") },
    { key: "operations", label: t("operations.label") },
    { key: "ledger", label: t("d.shell.ledger") },
  ];

  return (
    <div className="navigation-rail">
      {items.map(({ key, label }) => {
        const active = destination === key;
        return (
          <button
            key={key}
            type="button"
            aria-label={key === "inbox" && inboxCount > 0 ? `${label} (${inboxCount})` : label}
            title={label}
            aria-pressed={active}
            onClick={() => onNavigate(key)}
            className={`navigation-rail__button${active ? " navigation-rail__button--active" : ""}`}
          >
            {active && (reduced ? (
              <span aria-hidden="true" className="navigation-rail__pill" />
            ) : (
              <motion.span aria-hidden="true" layoutId="rail-active" className="navigation-rail__pill" transition={railGlide} />
            ))}
            <span className="navigation-rail__glyph">{ICONS[key]}</span>
            {key === "inbox" && inboxCount > 0 && <span aria-hidden="true" className="navigation-rail__badge">{inboxCount}</span>}
          </button>
        );
      })}
      <div className="navigation-rail__divider" aria-hidden="true" />
      <button
        type="button"
        aria-label={t("mobile.command.capture")}
        title={t("mobile.command.capture")}
        onClick={onCapture}
        className="navigation-rail__button navigation-rail__button--capture"
      >
        <span className="navigation-rail__glyph"><IconPlus /></span>
      </button>
    </div>
  );
}
