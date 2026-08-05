import type { Transition } from "framer-motion";

// Night Cartography motion grammar — one spring for overlay dialogs, one for
// docked chrome, one ambient fade. All chrome animates transform/opacity only
// so the canvas render loop stays cheap. Content motion (TaskCard, PortalNode)
// keeps its own tuned springs.
export const dialogSpring: Transition = { type: "spring", stiffness: 380, damping: 30 };
export const chromeSpring: Transition = { type: "spring", stiffness: 360, damping: 32 };
export const ambientFade: Transition = { duration: 0.35, ease: "easeOut" };
/** Menu/popover entrance: a snappy scale-pop. */
export const menuPop: Transition = { type: "spring", stiffness: 520, damping: 32 };
/** Scrims/backdrops and reduced-motion fallbacks. */
export const quickFade: Transition = { duration: 0.15, ease: "easeOut" };
