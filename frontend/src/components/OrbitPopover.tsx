import { useState } from "react";
import { useStore, CARD_W, CARD_H, type Task } from "../store";
import { useT, dateLocale } from "../i18n";

// Lists snoozed ("in orbit") tasks and lets you bring one back immediately.
// Self-gating: renders nothing when no task is in orbit, so the toolbar chip
// disappears the moment the last one is woken.
export function OrbitPopover() {
  const t = useT();
  const tasks = useStore((s) => s.tasks);
  const [open, setOpen] = useState(false);

  const now = Date.now();
  const orbit = tasks
    .filter((task) => task.snoozedUntil && Date.parse(task.snoozedUntil) > now && !task.archivedAt)
    .sort((a, b) => Date.parse(a.snoozedUntil!) - Date.parse(b.snoozedUntil!));

  if (orbit.length === 0) return null;

  const wake = (task: Task) => {
    const store = useStore.getState();
    store
      .patchTask(task.id, { snoozedUntil: null })
      .then(() => {
        store.showToast(t("a.orbit.woke", { title: task.title }));
        store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, Math.max(store.zoom, 0.8));
        store.flashTask(task.id);
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-2 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
          open ? "bg-white/10 text-indigo-200" : "text-indigo-300 hover:text-indigo-200"
        }`}
        title={t("a.toolbar.orbitTitle")}
      >
        ☾ {t("a.toolbar.orbit", { count: orbit.length })}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-[#1a1d24]/98 border border-white/15 shadow-2xl p-2">
            <div className="px-1.5 pb-1.5 text-[10px] uppercase tracking-wider text-gray-500">
              {t("a.orbit.heading", { count: orbit.length })}
            </div>
            <div className="flex flex-col gap-0.5 max-h-80 overflow-y-auto">
              {orbit.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: task.color }} />
                    <span className="text-xs text-gray-200 truncate">{task.title}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 pl-4">
                    <span className="text-[10px] text-gray-500 truncate">
                      {t("a.orbit.wakesOn", {
                        date: new Date(task.snoozedUntil!).toLocaleDateString(dateLocale()),
                      })}
                    </span>
                    <button
                      onClick={() => wake(task)}
                      className="shrink-0 text-[10px] text-indigo-300 hover:text-white px-2 py-1 rounded-md border border-indigo-500/30 hover:bg-indigo-500/15 transition-colors whitespace-nowrap"
                    >
                      ↩ {t("a.orbit.wake")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
