import { useStore, visibleTasks, DAY_W } from "../store";
import { TIME_GUTTER_X } from "./TaskCard";
import { dailyCapacityMinutes, formatMinutes, loadByDay, localDayKey } from "../utils/capacity";
import { useT, dateLocale } from "../i18n";

// Week gridlines + labels for the time lens, rendered in world space —
// plus the capacity horizon: per-day load bars that show which days are full.
export function TimeAxis() {
  const lens = useStore((s) => s.lens);
  const originX = useStore((s) => s.timeOriginX);
  const panY = useStore((s) => s.panY);
  const zoom = useStore((s) => s.zoom);
  const tasks = useStore((s) => s.tasks);
  const showDone = useStore((s) => s.showDone);
  const showArchived = useStore((s) => s.showArchived);
  const t = useT();

  if (lens !== "time" || originX === null) return null;

  const labelY = (16 - panY) / zoom; // pinned near the viewport's top edge
  const weeks = [];
  for (let w = -4; w <= 16; w++) weeks.push(w);
  const fmt = (d: Date) => d.toLocaleDateString(dateLocale(), { month: "short", day: "numeric" });

  // Capacity horizon
  const daily = dailyCapacityMinutes();
  const load = loadByDay(visibleTasks(tasks, showDone, showArchived));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon: Array<{ x: number; minutes: number; ratio: number }> = [];
  for (const [key, minutes] of load) {
    const days = Math.round((new Date(`${key}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
    if (days < -28 || days > 7 * 16) continue;
    horizon.push({ x: originX + days * DAY_W, minutes, ratio: minutes / daily });
  }

  const washColor = (ratio: number) =>
    ratio > 1
      ? "rgba(239, 68, 68, 0.13)"
      : ratio > 0.7
        ? "rgba(245, 158, 11, 0.09)"
        : "rgba(34, 211, 238, 0.05)";

  return (
    <div className="pointer-events-none">
      {/* Per-day load wash + badge */}
      {horizon.map(({ x, minutes, ratio }) => (
        <div key={x}>
          <div
            className="absolute"
            style={{
              left: x - DAY_W / 2,
              top: -4000,
              height: 12000,
              width: DAY_W,
              background: washColor(ratio),
            }}
          />
          <div
            className={`absolute text-[10px] px-1 py-0.5 rounded whitespace-nowrap -translate-x-1/2 ${
              ratio > 1 ? "text-red-300 bg-red-950/70" : ratio > 0.7 ? "text-amber-300 bg-[#0f0f13]/70" : "text-cyan-300/70 bg-[#0f0f13]/60"
            }`}
            style={{ left: x, top: labelY + 26 / zoom }}
          >
            {formatMinutes(minutes)}
            {ratio > 1 && ` · +${formatMinutes(minutes - daily)} ${t("c.timeaxis.over")}`}
          </div>
        </div>
      ))}

      {weeks.map((w) => {
        const x = originX + w * 7 * DAY_W;
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + w * 7);
        const isToday = w === 0;
        return (
          <div key={w}>
            <div
              className="absolute"
              style={{
                left: x,
                top: -4000,
                height: 12000,
                width: isToday ? 2 : 1,
                background: isToday ? "rgba(34, 211, 238, 0.5)" : "rgba(255, 255, 255, 0.08)",
              }}
            />
            <div
              className={`absolute text-[11px] whitespace-nowrap px-1.5 py-0.5 rounded ${
                isToday ? "text-cyan-300 bg-cyan-950/60" : "text-gray-500 bg-[#0f0f13]/60"
              }`}
              style={{ left: x + 6, top: labelY }}
            >
              {isToday ? t("c.timeaxis.today") : fmt(date)}
            </div>
          </div>
        );
      })}
      {/* Someday gutter */}
      <div
        className="absolute text-[11px] text-gray-500 bg-[#0f0f13]/60 px-1.5 py-0.5 rounded"
        style={{ left: originX - TIME_GUTTER_X, top: labelY }}
      >
        {t("c.timeaxis.someday")}
      </div>
      <div
        className="absolute"
        style={{
          left: originX - TIME_GUTTER_X / 2,
          top: -4000,
          height: 12000,
          width: 1,
          background: "rgba(255, 255, 255, 0.05)",
          borderLeft: "1px dashed rgba(255,255,255,0.12)",
        }}
      />
    </div>
  );
}
