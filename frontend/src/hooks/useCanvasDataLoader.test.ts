import { describe, expect, it, vi } from "vitest";
import { loadCanvasData } from "./useCanvasDataLoader";

describe("loadCanvasData", () => {
  it("loads task and workstream data before declaring the Inbox ready", async () => {
    const statuses: string[] = [];
    const loaders = {
      refreshTasks: vi.fn(async () => {}),
      loadWorkstreams: vi.fn(async () => {}),
      loadBubbles: vi.fn(async () => {}),
      loadDependencies: vi.fn(async () => {}),
      loadPortals: vi.fn(async () => {}),
      loadZones: vi.fn(async () => {}),
      loadConnections: vi.fn(async () => {}),
    };

    await loadCanvasData("canvas-1", loaders, (state) => statuses.push(state));

    expect(statuses).toEqual(["loading", "ready"]);
    for (const loader of Object.values(loaders)) {
      expect(loader).toHaveBeenCalledWith("canvas-1");
    }
  });

  it("reports an Inbox error when the required workstream load fails", async () => {
    const statuses: string[] = [];
    const loaders = {
      refreshTasks: vi.fn(async () => {}),
      loadWorkstreams: vi.fn(async () => { throw new Error("workstreams unavailable"); }),
      loadBubbles: vi.fn(async () => {}),
      loadDependencies: vi.fn(async () => {}),
      loadPortals: vi.fn(async () => {}),
      loadZones: vi.fn(async () => {}),
      loadConnections: vi.fn(async () => {}),
    };

    await expect(loadCanvasData("canvas-1", loaders, (state) => statuses.push(state))).rejects.toThrow("workstreams unavailable");
    expect(statuses).toEqual(["loading", "error"]);
  });
});
