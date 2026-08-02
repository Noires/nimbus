import { describe, expect, it } from "vitest";
import type { Task, Zone } from "../store";
import { selectEffectiveZone } from "./spatialZoneSelectors";

const taskAt = (x: number, y: number): Pick<Task, "x" | "y"> => ({ x, y });
const zone = (id: string, x: number, y: number, w: number, h: number): Zone => ({
  id, canvasId: "canvas-1", x, y, w, h, label: id, hue: 200, autoTag: null, z: 0,
});

describe("selectEffectiveZone", () => {
  it("reports outside when the task center matches no zones", () => {
    expect(selectEffectiveZone(taskAt(0, 0), [zone("zone-1", 200, 200, 300, 300)])).toEqual({ kind: "outside" });
  });
  it("assigns the only zone containing the task center", () => {
    const assigned = zone("zone-1", 100, 100, 300, 300);
    expect(selectEffectiveZone(taskAt(150, 150), [assigned])).toEqual({ kind: "assigned", zone: assigned });
  });
  it("reports overlapping zone IDs in immutable-ID order without choosing one", () => {
    expect(selectEffectiveZone(taskAt(150, 150), [zone("zone-b", 120, 120, 300, 300), zone("zone-a", 100, 100, 300, 300)])).toEqual({ kind: "ambiguous", zoneIds: ["zone-a", "zone-b"] });
  });
  it("treats a card center exactly on a Zone boundary as inside", () => {
    const assigned = zone("zone-1", 100, 100, 256, 170);
    expect(selectEffectiveZone(taskAt(228, 185), [assigned])).toEqual({ kind: "assigned", zone: assigned });
  });
  it("is pure and order-independent for overlapping zones", () => {
    const task = taskAt(150, 150);
    const zones = [zone("zone-b", 120, 120, 300, 300), zone("zone-a", 100, 100, 300, 300)];
    const before = structuredClone({ task, zones });

    expect(selectEffectiveZone(task, zones)).toEqual(selectEffectiveZone(task, [...zones].reverse()));
    expect({ task, zones }).toEqual(before);
  });
});
