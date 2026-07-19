import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, visibleTasks, CARD_W, CARD_H } from "../store";
import { dailyCapacityMinutes, formatMinutes, loadByDay, localDayKey } from "../utils/capacity";
import { urgencyColor } from "../utils/colors";
import { useT, dateLocale } from "../i18n";

const DAYS = 14;

// TaskCard drop-detection handshake: the dock registers its screen rect and
// day keys here; TaskCard's pointerup hit-tests against it.
export const dayDockHit: {
  current: { rect: DOMRect; days: string[] } | null;
} = { current: null };

// A 14-day strip along the bottom edge: throw a card at a day to schedule it.
export function DayDock() {
  const open = useStore((s) => s.dayDockOpen);
  const tasks = useStore((s) => s.tasks);
  const showDone = useStore((s) => s.showDone);
  const showArchived = useStore((s) => s.showArchived);
  const dayFilter = useStore((s) => s.dayFilter);
  const dragging = useStore((s) => s.draggingTaskId);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useT();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: Array<{ key: string; date: Date }> = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push({ key: localDayKey(d), date: d });
  }

  // Register/unregister the drop target for TaskCard.
  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      dayDockHit.current = open && el ? { rect: el.getBoundingClientRect(), days: days.map((d) => d.key) } : null;
    };
    update();
    window.addEventListener("resize", update);
    const interval = setInterval(update, 1000); // canvas panning doesn't move it, but toolbars might
    return () => {
      window.removeEventListener("resize", update);
      clearInterval(interval);
      dayDockHit.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, days.map((d) => d.key).join(",")]);

  const shown = visibleTasks(tasks, showDone, showArchived);
  const load = loadByDay(shown);
  const counts = new Map<string, number>();
  for (const t of shown) {
    if (t.done || !t.dueDate) continue;
    const key = localDayKey(t.dueDate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const overdueCount = shown.filter(
    (t) => !t.done && t.dueDate && localDayKey(t.dueDate) < days[0].key,
  ).length;
  const daily = dailyCapacityMinutes();

  const flyToFirst = (dayKey: string) => {
    const store = useStore.getState();
    const first = shown.find((t) => !t.done && t.dueDate && localDayKey(t.dueDate) === dayKey);
    if (first) {
      store.flyTo(first.x + CARD_W / 2, first.y + CARD_H / 2, 1);
      store.flashTask(first.id);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: dragging ? -8 : 0 }}
          exit={{ opacity: 0, y: 48 }}
          transition={{ type: "spring", stiffness: 360, damping: 32 }}
          className={`absolute bottom-2 left-1/2 -translate-x-1/2 z-[60] flex items-stretch gap-1 rounded-xl bg-[#1a1d24]/95 backdrop-blur-md border px-2 py-1.5 shadow-2xl ${
            dragging ? "border-cyan-400/60" : "border-white/10"
          }`}
        >
          {overdueCount > 0 && (
            <div className="flex flex-col items-center justify-center px-2 rounded-lg bg-red-500/10 border border-red-500/40">
              <span className="text-[10px] text-red-400 font-medium">{overdueCount}</span>
              <span className="text-[8px] text-red-400/70">{t("c.day.overdue")}</span>
            </div>
          )}
          {days.map(({ key, date }) => {
            const minutes = load.get(key) ?? 0;
            const count = counts.get(key) ?? 0;
            const isToday = key === days[0].key;
            const filtered = dayFilter === key;
            const daysOut = Math.round((date.getTime() - today.getTime()) / 86_400_000);
            const weekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <button
                key={key}
                onClick={() => {
                  useStore.getState().setDayFilter(filtered ? null : key);
                  if (!filtered) flyToFirst(key);
                }}
                className={`flex flex-col items-center justify-between w-11 py-1 rounded-lg border transition-colors ${
                  filtered
                    ? "border-cyan-400/70 bg-cyan-500/15"
                    : dragging
                      ? "border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/15"
                      : weekend
                        ? "border-white/5 bg-white/[0.02] hover:bg-white/5"
                        : "border-white/10 hover:bg-white/5"
                }`}
                title={
                  count
                    ? t("c.day.dueTooltip", { count, time: formatMinutes(minutes) })
                    : t("c.day.dropTooltip")
                }
              >
                <span className={`text-[8px] uppercase ${isToday ? "text-cyan-300" : "text-gray-500"}`}>
                  {isToday ? t("c.day.today") : date.toLocaleDateString(dateLocale(), { weekday: "short" })}
                </span>
                <span className={`text-[11px] ${isToday ? "text-cyan-200" : "text-gray-300"}`}>
                  {date.getDate()}
                </span>
                <span className="flex gap-[2px] h-1.5 items-center">
                  {Array.from({ length: Math.min(count, 4) }, (_, i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ background: urgencyColor(daysOut) }}
                    />
                  ))}
                </span>
                <span
                  className={`text-[8px] ${
                    minutes > daily ? "text-red-400" : minutes > 0 ? "text-gray-500" : "text-transparent"
                  }`}
                >
                  {minutes > 0 ? formatMinutes(minutes) : "·"}
                </span>
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
