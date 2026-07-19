import { useStore, CARD_W, CARD_H, type CanvasSettings } from "../store";
import { localDayKey } from "./capacity";

export async function ensureNotifyPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

function canNotify(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

export function notify(title: string, body: string, taskId?: string) {
  if (!canNotify()) return;
  const n = new Notification(title, { body, tag: `${title}:${body}` });
  n.onclick = () => {
    window.focus();
    if (taskId) {
      const task = useStore.getState().tasks.find((t) => t.id === taskId);
      if (task) {
        useStore.getState().flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, 1);
        useStore.getState().flashTask(task.id);
      }
    }
    n.close();
  };
}

function settingsFor(canvasId: string): CanvasSettings {
  const canvas = useStore.getState().canvases.find((c) => c.id === canvasId);
  return (canvas?.settings as CanvasSettings) ?? {};
}

// 60s checker: daily digest at the chosen hour + snoozed-task wake pings.
// Per-day dedupe via localStorage so nothing double-fires across reloads.
export function startNotificationLoop(getCanvasId: () => string | null): () => void {
  let lastWakeSweep = Date.now();

  const tick = () => {
    const canvasId = getCanvasId();
    if (!canvasId || !canNotify()) return;
    const settings = settingsFor(canvasId);
    const store = useStore.getState();
    const now = Date.now();
    const todayKey = localDayKey(new Date());

    // Daily digest
    if (settings.digestHour != null && new Date().getHours() >= settings.digestHour) {
      const marker = `digest-sent:${canvasId}`;
      if (localStorage.getItem(marker) !== todayKey) {
        const open = store.tasks.filter((t) => !t.done && !t.archivedAt && !t.inbox);
        const overdue = open.filter((t) => t.dueDate && Date.parse(t.dueDate) < now).length;
        const dueToday = open.filter((t) => t.dueDate && localDayKey(t.dueDate) === todayKey).length;
        const waking = open.filter(
          (t) => t.snoozedUntil && localDayKey(t.snoozedUntil) === todayKey,
        ).length;
        if (overdue + dueToday + waking > 0) {
          notify(
            "Task dashboard — today",
            [
              dueToday ? `${dueToday} due today` : null,
              overdue ? `${overdue} overdue` : null,
              waking ? `${waking} waking from orbit` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          );
        }
        localStorage.setItem(marker, todayKey);
      }
    }

    // Snoozed tasks waking up since the last sweep
    if (settings.notifyWake) {
      for (const t of store.tasks) {
        if (!t.snoozedUntil || t.done || t.archivedAt) continue;
        const wake = Date.parse(t.snoozedUntil);
        if (wake > lastWakeSweep && wake <= now) {
          notify("Back from orbit", t.title, t.id);
          store.flashTask(t.id);
        }
      }
    }
    lastWakeSweep = now;
  };

  const interval = setInterval(tick, 60_000);
  tick();
  return () => clearInterval(interval);
}
