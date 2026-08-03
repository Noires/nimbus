import { describe, expect, it } from "vitest";
import { TUTORIAL_SAMPLE_CANVAS, applyTutorialSampleAction, createTutorialSample } from "./tutorialSample";

describe("tutorial sample boundary", () => {
  it("creates a deterministic, isolated record set on every reset", () => {
    const first = createTutorialSample();
    const changed = applyTutorialSampleAction(first, "capture");
    const reset = createTutorialSample();

    expect(TUTORIAL_SAMPLE_CANVAS).toMatchObject({
      id: "tutorial-sample-canvas",
      task: { id: "tutorial-sample-task" },
      workstream: { id: "tutorial-sample-workstream" },
    });
    expect(first).toEqual(reset);
    expect(reset).not.toBe(first);
    expect(changed).not.toBe(first);
    expect(first.captured).toBe(false);
  });

  it("advances only explicit tutorial-owned records in the approved workflow order without mutating the prior checkpoint", () => {
    const initial = createTutorialSample();
    const captured = applyTutorialSampleAction(initial, "capture");
    const triaged = applyTutorialSampleAction(captured, "triage");
    const inspected = applyTutorialSampleAction(triaged, "workstream");
    const focused = applyTutorialSampleAction(inspected, "today");
    const complete = applyTutorialSampleAction(focused, "complete");

    expect(initial).toEqual(createTutorialSample());
    expect(captured).toMatchObject({ captured: true, triaged: false, assigned: false, today: false });
    expect(triaged).toMatchObject({ captured: true, triaged: true, assigned: true, today: false });
    expect(inspected).toMatchObject({ workstreamInspected: true, today: false });
    expect(focused).toMatchObject({ captured: true, triaged: true, today: true, completed: false });
    expect(complete).toMatchObject({ captured: true, triaged: true, today: true, completed: true });
  });

  it("rejects sample actions that bypass the approved workflow order", () => {
    const initial = createTutorialSample();
    const triaged = applyTutorialSampleAction(applyTutorialSampleAction(initial, "capture"), "triage");

    expect(applyTutorialSampleAction(initial, "triage")).toEqual(initial);
    expect(applyTutorialSampleAction(triaged, "today")).toEqual(triaged);
    expect(applyTutorialSampleAction(triaged, "complete")).toEqual(triaged);
    expect(applyTutorialSampleAction(triaged, "review")).toEqual(triaged);
  });
});
