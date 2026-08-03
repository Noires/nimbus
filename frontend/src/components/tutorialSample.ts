/**
 * Tutorial-only record set and reducer.
 *
 * This module intentionally has no dependency on the productive Zustand store,
 * API client, Canvas selection, history, zones, or settings. The tutorial
 * dialog owns its checkpoint in localStorage and may only apply these explicit
 * sample actions. Keeping the boundary here makes it auditable and lets reset
 * always reproduce the same private example Canvas.
 */
export type TutorialSampleState = {
  captured: boolean;
  triaged: boolean;
  assigned: boolean;
  today: boolean;
  completed: boolean;
  workstreamInspected: boolean;
  reviewInspected: boolean;
};

export type TutorialSampleAction = "capture" | "triage" | "today" | "workstream" | "complete" | "review";

export const TUTORIAL_SAMPLE_CANVAS = {
  id: "tutorial-sample-canvas",
  // Display labels are derived exclusively from tutorial.* i18n keys by the
  // dialog; keeping this boundary locale-neutral prevents stale English
  // sample records from leaking into a German tutorial.
  task: { id: "tutorial-sample-task" },
  inbox: { id: "tutorial-sample-inbox" },
  workstream: { id: "tutorial-sample-workstream" },
} as const;

export function createTutorialSample(): TutorialSampleState {
  return {
    captured: false,
    triaged: false,
    assigned: false,
    today: false,
    completed: false,
    workstreamInspected: false,
    reviewInspected: false,
  };
}

/** Apply one explicit action to the isolated record set; never mutates input. */
export function applyTutorialSampleAction(sample: TutorialSampleState, action: TutorialSampleAction): TutorialSampleState {
  switch (action) {
    case "capture": return { ...sample, captured: true };
    case "triage": return { ...sample, captured: true, triaged: true, assigned: true };
    case "today": return { ...sample, captured: true, triaged: true, today: true };
    case "complete": return { ...sample, captured: true, triaged: true, today: true, completed: true };
    case "workstream": return { ...sample, workstreamInspected: true };
    case "review": return { ...sample, reviewInspected: true };
  }
}
