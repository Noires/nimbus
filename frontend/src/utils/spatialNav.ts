import { CARD_W, CARD_H, type Task } from "../store";

export type Direction = "up" | "down" | "left" | "right";

const VECTORS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/** Nearest card in a direction: distance penalized by perpendicular offset,
 *  restricted to a ~100° cone so "right" never picks something above you. */
export function nearestInDirection(from: Task, candidates: Task[], dir: Direction): Task | null {
  const { dx, dy } = VECTORS[dir];
  const fx = from.x + CARD_W / 2;
  const fy = from.y + CARD_H / 2;

  let best: Task | null = null;
  let bestScore = Infinity;
  for (const task of candidates) {
    if (task.id === from.id) continue;
    const vx = task.x + CARD_W / 2 - fx;
    const vy = task.y + CARD_H / 2 - fy;
    const along = vx * dx + vy * dy; // progress in the wanted direction
    if (along <= 0) continue;
    const perp = Math.abs(vx * dy - vy * dx);
    if (perp > along * 1.2) continue; // outside the cone
    const score = along + 2 * perp;
    if (score < bestScore) {
      bestScore = score;
      best = task;
    }
  }
  return best;
}

/** Card nearest the given world point (fallback when nothing is selected). */
export function nearestToPoint(candidates: Task[], x: number, y: number): Task | null {
  let best: Task | null = null;
  let bestDist = Infinity;
  for (const task of candidates) {
    const d = Math.hypot(task.x + CARD_W / 2 - x, task.y + CARD_H / 2 - y);
    if (d < bestDist) {
      bestDist = d;
      best = task;
    }
  }
  return best;
}
