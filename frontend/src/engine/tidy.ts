import { CARD_W, CARD_H } from "../store";
import type { Cluster } from "./proximityDetector";

/** Minimum edge-to-edge gap between separated groups. Must keep cards of
 *  DIFFERENT groups outside the 276px cluster hysteresis in the worst case
 *  (two cards facing across the gap vertically: 170px card + gap > 276px),
 *  or tidying would merge neighboring bubbles. */
export const TIDY_GAP = 120;

interface TaskLike {
  id: string;
  x: number;
  y: number;
}

interface Box {
  memberIds: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
}

/** Resolve overlaps between bubbles and loose cards. Each proximity cluster
 *  moves as one rigid unit so bubble memberships survive the tidy; loose
 *  cards are their own unit. Iterative pairwise AABB separation along the
 *  axis of least overlap. Returns new positions for every task that moves. */
export function computeTidyMoves(
  tasks: TaskLike[],
  clusters: Cluster[],
): Map<string, { x: number; y: number }> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const clustered = new Set(clusters.flatMap((c) => c.members));
  const units: string[][] = [
    ...clusters.map((c) => c.members.filter((id) => byId.has(id))),
    ...tasks.filter((t) => !clustered.has(t.id)).map((t) => [t.id]),
  ].filter((ids) => ids.length > 0);

  const boxes: Box[] = units.map((memberIds) => {
    const members = memberIds.map((id) => byId.get(id)!);
    const minX = Math.min(...members.map((t) => t.x));
    const minY = Math.min(...members.map((t) => t.y));
    const maxX = Math.max(...members.map((t) => t.x + CARD_W));
    const maxY = Math.max(...members.map((t) => t.y + CARD_H));
    return { memberIds, x: minX, y: minY, w: maxX - minX, h: maxY - minY, dx: 0, dy: 0 };
  });

  // Relaxation: push overlapping pairs apart half-and-half until stable.
  // Deterministic (no randomness) so undo/redo and re-runs are reproducible.
  for (let iter = 0; iter < 400; iter++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const ax = a.x + a.dx;
        const ay = a.y + a.dy;
        const bx = b.x + b.dx;
        const by = b.y + b.dy;
        const overlapX = Math.min(ax + a.w, bx + b.w) - Math.max(ax, bx) + TIDY_GAP;
        const overlapY = Math.min(ay + a.h, by + b.h) - Math.max(ay, by) + TIDY_GAP;
        if (overlapX <= 0 || overlapY <= 0) continue;

        moved = true;
        if (overlapX <= overlapY) {
          // Tie-break by index when centers coincide, so the pair still separates.
          const dir = ax + a.w / 2 <= bx + b.w / 2 ? 1 : -1;
          a.dx -= (dir * overlapX) / 2;
          b.dx += (dir * overlapX) / 2;
        } else {
          const dir = ay + a.h / 2 <= by + b.h / 2 ? 1 : -1;
          a.dy -= (dir * overlapY) / 2;
          b.dy += (dir * overlapY) / 2;
        }
      }
    }
    if (!moved) break;
  }

  const moves = new Map<string, { x: number; y: number }>();
  for (const box of boxes) {
    const dx = Math.round(box.dx);
    const dy = Math.round(box.dy);
    if (dx === 0 && dy === 0) continue;
    for (const id of box.memberIds) {
      const task = byId.get(id)!;
      moves.set(id, { x: task.x + dx, y: task.y + dy });
    }
  }
  return moves;
}
