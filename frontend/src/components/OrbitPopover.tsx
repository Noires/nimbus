import { useState } from "react";
import { useStore, CARD_W, CARD_H, type Task } from "../store";
import { useT, dateLocale } from "../i18n";
import { MenuPanel } from "./toolbarMenu";

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
        className={`px-2 py-1 rounded-nc-sm text-xs whitespace-nowrap transition-colors ${
          open ? "bg-nc-fill text-nc-text" : "text-nc-muted hover:text-nc-text"
        }`}
        title={t("a.toolbar.orbitTitle")}
      >
        <span aria-hidden="true">☾</span> {t("a.toolbar.orbit", { count: orbit.length })}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <MenuPanel className="absolute left-0 top-9 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-nc-lg bg-nc-raised/95 backdrop-blur-md border border-nc-line shadow-nc-lg p-2">
            <div className="px-1.5 pb-1.5 text-2xs uppercase tracking-wider text-nc-soft">
              {t("a.orbit.heading", { count: orbit.length })}
            </div>
            <div className="flex flex-col gap-0.5 max-h-80 overflow-y-auto">
              {orbit.map((task) => (
                <div
                  key={task.id}
                  className="rounded-nc-md px-2 py-1.5 hover:bg-nc-fill-faint transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: task.color }} />
                    <span className="text-xs text-nc-text truncate">{task.title}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 pl-4">
                    <span className="text-2xs text-nc-faint truncate">
                      {t("a.orbit.wakesOn", {
                        date: new Date(task.snoozedUntil!).toLocaleDateString(dateLocale()),
                      })}
                    </span>
                    <button
                      onClick={() => wake(task)}
                      className="shrink-0 text-2xs text-nc-accent px-2 py-1 rounded-nc-sm border border-nc-accent-border hover:bg-nc-accent-muted transition-colors whitespace-nowrap"
                    >
                      <span aria-hidden="true">↩</span> {t("a.orbit.wake")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </MenuPanel>
        </>
      )}
    </div>
  );
}
