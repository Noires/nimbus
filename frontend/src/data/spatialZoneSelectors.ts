import { CARD_H, CARD_W, type Task, type Zone } from "../store";

export type ZoneResolution =
  | { kind: "assigned"; zone: Zone }
  | { kind: "outside" }
  | { kind: "ambiguous"; zoneIds: string[] };

type TaskPosition = Pick<Task, "x" | "y">;

/** Returns every Zone whose inclusive rectangle contains the Task card center. */
export function selectZonesContainingTask(task: TaskPosition, zones: readonly Zone[]): Zone[] {
  const centerX = task.x + CARD_W / 2;
  const centerY = task.y + CARD_H / 2;
  return zones.filter((zone) =>
    centerX >= zone.x && centerX <= zone.x + zone.w && centerY >= zone.y && centerY <= zone.y + zone.h,
  );
}

/** Resolves a task only if its center is in exactly one persisted Zone. */
export function selectEffectiveZone(task: TaskPosition, zones: readonly Zone[]): ZoneResolution {
  const matches = selectZonesContainingTask(task, zones);
  if (matches.length === 0) return { kind: "outside" };
  if (matches.length === 1) return { kind: "assigned", zone: matches[0] };
  return { kind: "ambiguous", zoneIds: matches.map((zone) => zone.id).sort() };
}
