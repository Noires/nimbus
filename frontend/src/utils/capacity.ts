import type { Task } from "../store";

const KEY = "weekly-capacity-hours";

export const DEFAULT_ESTIMATE_MINUTES = 60;

/** Local-timezone yyyy-mm-dd key (toISOString would shift days near midnight). */
export function localDayKey(dateInput: string | Date): string {
  const d = new Date(dateInput);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dailyCapacityMinutes(): number {
  return (getCapacityHours() * 60) / 5;
}

/** Remaining estimated minutes per due-day for open tasks. */
export function loadByDay(tasks: Task[]): Map<string, number> {
  const load = new Map<string, number>();
  for (const t of tasks) {
    if (t.done || t.archivedAt || !t.dueDate) continue;
    const key = localDayKey(t.dueDate);
    load.set(key, (load.get(key) ?? 0) + (t.estimateMinutes ?? DEFAULT_ESTIMATE_MINUTES));
  }
  return load;
}

export function getCapacityHours(): number {
  const raw = Number(localStorage.getItem(KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : 40;
}

export function setCapacityHours(hours: number) {
  localStorage.setItem(KEY, String(hours));
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h}h` : `${Math.floor(h)}h${minutes % 60}m`;
}

export const ESTIMATE_CHOICES = [15, 30, 60, 120, 240, 480];
