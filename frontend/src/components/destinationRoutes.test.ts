import { describe, expect, it } from "vitest";
import { canvasDestinationFromPath, canvasPathForDestination } from "./destinationRoutes";

describe("destination routes", () => {
  it("maps each canonical desktop destination without changing the canvas identity", () => {
    const canvasId = "canvas-42";
    expect(canvasDestinationFromPath(`/canvas/${canvasId}`, canvasId)).toBe("canvas");
    expect(canvasDestinationFromPath(`/canvas/${canvasId}/inbox`, canvasId)).toBe("inbox");
    expect(canvasDestinationFromPath(`/canvas/${canvasId}/today`, canvasId)).toBe("today");
    expect(canvasDestinationFromPath(`/canvas/${canvasId}/review/blocked`, canvasId)).toBe("review");
    expect(canvasDestinationFromPath(`/canvas/${canvasId}/operations`, canvasId)).toBe("operations");
    expect(canvasDestinationFromPath(`/canvas/${canvasId}/ledger/saved-view`, canvasId)).toBe("ledger");
  });

  it("writes canonical paths for six first-class destinations", () => {
    expect(canvasPathForDestination("canvas-42", "canvas")).toBe("/canvas/canvas-42");
    expect(canvasPathForDestination("canvas-42", "inbox")).toBe("/canvas/canvas-42/inbox");
    expect(canvasPathForDestination("canvas-42", "today")).toBe("/canvas/canvas-42/today");
    expect(canvasPathForDestination("canvas-42", "review")).toBe("/canvas/canvas-42/review");
    expect(canvasPathForDestination("canvas-42", "operations")).toBe("/canvas/canvas-42/operations");
    expect(canvasPathForDestination("canvas-42", "ledger")).toBe("/canvas/canvas-42/ledger");
  });
});
