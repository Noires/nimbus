/** Pure step data for the guided tour — no DOM access at module scope.
 * `selectors` is an ordered fallback chain (first match wins); an empty list
 * means a centered card with a full scrim. Optional steps auto-skip when no
 * selector matches at runtime. */
export type GuidedTourStepId = "welcome" | "canvas" | "capture" | "destinations" | "toolbar" | "rail" | "finish";

export interface GuidedTourStep {
  id: GuidedTourStepId;
  selectors: string[];
  optional: boolean;
  /** Spotlight inset around the anchor, px. */
  padding: number;
}

export const GUIDED_TOUR_STEPS: GuidedTourStep[] = [
  { id: "welcome", selectors: [], optional: false, padding: 0 },
  { id: "canvas", selectors: ['[data-tour="task-card"]', ".night-cartography--canvas"], optional: true, padding: 10 },
  { id: "capture", selectors: [".navigation-rail__button--capture"], optional: true, padding: 8 },
  { id: "destinations", selectors: [".navigation-rail"], optional: true, padding: 8 },
  { id: "toolbar", selectors: [".canvas-toolbar"], optional: true, padding: 8 },
  { id: "rail", selectors: [".command-center-shell__rail", ".command-center-shell__rail-open"], optional: true, padding: 8 },
  { id: "finish", selectors: [], optional: false, padding: 0 },
];
