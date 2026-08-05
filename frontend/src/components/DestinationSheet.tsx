import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ambientFade, dialogSpring } from "../utils/motion";
import type { CanvasDestination } from "./destinationRoutes";
import { IconArrowLeft } from "./ui/icons";

/** A routed workspace sheet floating over the always-mounted canvas.
 * Deliberately NOT a dialog: no aria-modal, no focus trap — the canvas below
 * stays alive (its rAF/proximity loop keeps running; pan/zoom live in the
 * store) and the URL remains the source of truth. The global Escape handler
 * already navigates back to the canvas; the scrim and close button do the
 * same explicitly. Enter animation only — route changes unmount instantly. */
export function DestinationSheet({ kind, closeLabel, onClose, children }: {
  kind: Exclude<CanvasDestination, "canvas">;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <div className={`destination-sheet destination-sheet--${kind}`} data-destination-sheet={kind}>
      <motion.button
        type="button"
        className="destination-sheet__scrim"
        aria-label={closeLabel}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={ambientFade}
      />
      <motion.div
        className="destination-sheet__panel"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? ambientFade : dialogSpring}
      >
        <button type="button" className="destination-sheet__close" onClick={onClose}>
          <IconArrowLeft size={16} /> {closeLabel}
        </button>
        {children}
      </motion.div>
    </div>
  );
}
