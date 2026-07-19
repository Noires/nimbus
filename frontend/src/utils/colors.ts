// Deterministic per-card gradient seeded by task.id (djb2 hash), per plan §9.
function djb2(str: string): number {
  let h = 5381 >>> 0;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

export function cardGradient(id: string): string {
  const h = djb2(id);
  const hue1 = h % 360;
  const hue2 = (hue1 + 40 + (h >> 8) % 60) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 75%, 55%), hsl(${hue2}, 75%, 45%))`;
}

export function cardAccent(id: string): string {
  return `hsl(${djb2(id) % 360}, 75%, 60%)`;
}

export function clusterHue(id: string): number {
  return djb2(id) % 360;
}

// Deadline-gravity lens: halo color by time-to-due (cool = far, hot = now).
export function urgencyColor(daysUntilDue: number): string {
  if (daysUntilDue < 0) return "rgba(239, 68, 68, 0.6)";
  if (daysUntilDue === 0) return "rgba(245, 158, 11, 0.55)";
  if (daysUntilDue <= 3) return "rgba(234, 179, 8, 0.4)";
  if (daysUntilDue <= 7) return "rgba(34, 211, 238, 0.3)";
  return "rgba(34, 211, 238, 0.14)";
}

// Staleness-heat lens: halo color by days untouched (blue = fresh, ember = old).
export function stalenessColor(daysStale: number): string | null {
  if (daysStale < 1) return null;
  if (daysStale < 4) return "rgba(59, 130, 246, 0.25)";
  if (daysStale < 10) return "rgba(168, 85, 247, 0.35)";
  if (daysStale < 21) return "rgba(249, 115, 22, 0.45)";
  return "rgba(239, 68, 68, 0.6)";
}
