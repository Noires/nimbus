import type { Transition } from "framer-motion";

// Night Chart motion grammar — the complete, named vocabulary. Every framer
// surface uses exactly one entry (plus TaskCard's taskCardTransition, the
// only per-component curve). All chrome animates transform/opacity only so
// the canvas render loop stays cheap.
export const dialogSpring: Transition = { type: "spring", stiffness: 380, damping: 30 };
export const chromeSpring: Transition = { type: "spring", stiffness: 360, damping: 32 };
export const ambientFade: Transition = { duration: 0.35, ease: "easeOut" };
/** Menu/popover entrance: a snappy scale-pop. */
export const menuPop: Transition = { type: "spring", stiffness: 520, damping: 32 };
/** Scrims/backdrops and reduced-motion fallbacks. */
export const quickFade: Transition = { duration: 0.15, ease: "easeOut" };
/** THE signature moment: the rail's active pill gliding between icons. */
export const railGlide: Transition = { type: "spring", stiffness: 480, damping: 36 };
/** World-content entrance (portals): a soft settle. */
export const contentPop: Transition = { type: "spring", stiffness: 300, damping: 24 };
