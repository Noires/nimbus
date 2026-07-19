import { CARD_W, CARD_H, type Task } from "../store";

function overlapFraction(ax: number, ay: number, bx: number, by: number): number {
  const ox = Math.max(0, Math.min(ax + CARD_W, bx + CARD_W) - Math.max(ax, bx));
  const oy = Math.max(0, Math.min(ay + CARD_H, by + CARD_H) - Math.max(ay, by));
  return (ox * oy) / (CARD_W * CARD_H);
}

/** If the dropped position buries another card (>60% overlap), probe an
 *  expanding ring for the nearest free spot. Runs only on drop, never per-frame. */
export function resolveOverlap(
  pos: { x: number; y: number },
  droppedId: string,
  others: Task[],
): { x: number; y: number } | null {
  const near = others.filter(
    (o) => o.id !== droppedId && Math.abs(o.x - pos.x) < CARD_W * 2 && Math.abs(o.y - pos.y) < CARD_H * 2,
  );
  const buried = (x: number, y: number) => near.some((o) => overlapFraction(x, y, o.x, o.y) > 0.6);
  if (!buried(pos.x, pos.y)) return null;

  for (let r = 48; r <= 480; r += 48) {
    for (let k = 0; k < 16; k++) {
      const angle = (2 * Math.PI * k) / 16;
      const x = pos.x + r * Math.cos(angle);
      const y = pos.y + r * Math.sin(angle);
      if (!buried(x, y)) return { x, y };
    }
  }
  return null;
}
