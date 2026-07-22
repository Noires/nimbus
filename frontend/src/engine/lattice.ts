/** Diamond lattice for overlap-free, cluster-chained card layouts.
 *
 *  Geometry: cards are 256×~170 (CARD_W/CARD_H). Two cards overlap iff
 *  dx < 256 AND dy < 170; they chain into one proximity bubble iff their
 *  center distance ≤ 240 (THRESHOLD). Cells at (i·130, j·185) with even
 *  i+j satisfy both: the diagonal neighbor (130, 185) has dy = 185 > 170
 *  (no overlap) at distance √(130²+185²) ≈ 226 < 240 (chained); the
 *  same-row neighbor (260, 0) has dx = 260 > 256 (no overlap) and chains
 *  transitively through the diagonal. Filling cells in ascending distance
 *  from the center keeps the set connected: every cell has an
 *  earlier-filled diagonal neighbor closer to the center. */

export const LAT_DX = 130;
export const LAT_DY = 185;

/** Positions for `count` cards centered on (cx, cy). Deterministic. */
export function latticePositions(cx: number, cy: number, count: number): Array<{ x: number; y: number }> {
  if (count <= 0) return [];

  // Generate enough candidate cells: a k-shell diamond holds ~2k² cells.
  const shells = Math.max(2, Math.ceil(Math.sqrt(count)) + 1);
  const cells: Array<{ x: number; y: number; d: number; a: number }> = [];
  for (let i = -2 * shells; i <= 2 * shells; i++) {
    for (let j = -shells; j <= shells; j++) {
      if ((i + j) % 2 !== 0) continue;
      const x = i * LAT_DX;
      const y = j * LAT_DY;
      cells.push({ x, y, d: Math.hypot(x, y), a: Math.atan2(y, x) });
    }
  }
  cells.sort((p, q) => p.d - q.d || p.a - q.a);

  return cells.slice(0, count).map((c) => ({ x: cx + c.x, y: cy + c.y }));
}
