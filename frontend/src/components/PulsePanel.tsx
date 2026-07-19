import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api, type Pulse } from "../data/api";
import { useStore, CARD_W, CARD_H } from "../store";
import { useT } from "../i18n";

// Canvas Pulse: burndown, velocity, and the churn meter — an honest answer to
// "am I finishing things or just rearranging them?", from the event log.
export function PulsePanel({ canvasId, onClose }: { canvasId: string; onClose: () => void }) {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const bubbles = useStore((s) => s.bubbles);
  const tasks = useStore((s) => s.tasks);
  const t = useT();

  useEffect(() => {
    api.pulse(canvasId, 30).then(setPulse).catch((e) => console.error(e));
  }, [canvasId]);

  const stats = useMemo(() => {
    if (!pulse) return null;
    const days = pulse.days;
    // Reconstruct open-count backwards from today.
    const open: number[] = new Array(days.length).fill(0);
    let running = pulse.openNow;
    for (let i = days.length - 1; i >= 0; i--) {
      open[i] = running;
      running += days[i].completed + days[i].deleted - days[i].created;
    }
    const last7 = days.slice(-7);
    const prev7 = days.slice(-14, -7);
    const done7 = last7.reduce((s, d) => s + d.completed, 0);
    const donePrev7 = prev7.reduce((s, d) => s + d.completed, 0);
    const moved30 = days.reduce((s, d) => s + d.moved + d.updated, 0);
    const completed30 = days.reduce((s, d) => s + d.completed, 0);
    const churn = moved30 / Math.max(completed30, 1);
    return { open, done7, donePrev7, churn, moved30, completed30 };
  }, [pulse]);

  const maxBar = pulse
    ? Math.max(1, ...pulse.days.map((d) => Math.max(d.created, d.completed)))
    : 1;
  const maxOpen = stats ? Math.max(1, ...stats.open) : 1;

  const churnVerdict = (churn: number, completed: number) => {
    if (completed === 0) return t("c.pulse.verdictNone");
    if (churn > 8) return t("c.pulse.verdictHigh");
    if (churn > 4) return t("c.pulse.verdictModerate");
    return t("c.pulse.verdictLow");
  };

  const flyToBubble = (memberIds: string[]) => {
    const members = tasks.filter((t) => memberIds.includes(t.id));
    if (!members.length) return;
    const cx = members.reduce((s, t) => s + t.x + CARD_W / 2, 0) / members.length;
    const cy = members.reduce((s, t) => s + t.y + CARD_H / 2, 0) / members.length;
    useStore.getState().flyTo(cx, cy, 0.7);
    onClose();
  };

  return (
    <motion.div
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="absolute top-0 right-0 bottom-0 z-[70] w-80 bg-[#12141a]/97 backdrop-blur-xl border-l border-white/10 shadow-2xl overflow-y-auto p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-gray-200">{t("c.pulse.title")}</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-200">×</button>
      </div>

      {!pulse || !stats ? (
        <div className="text-xs text-gray-500">{t("c.pulse.loading")}</div>
      ) : (
        <>
          {/* Velocity */}
          <div className="flex items-center gap-5 mb-4">
            <div>
              <div className="text-xl font-semibold text-gray-100">{stats.done7}</div>
              <div className="text-[10px] text-gray-500">{t("c.pulse.done7")}</div>
            </div>
            <div className="text-xs text-gray-400">
              {stats.done7 > stats.donePrev7
                ? `▲ ${t("c.pulse.up", { count: stats.donePrev7 })}`
                : stats.done7 < stats.donePrev7
                  ? `▼ ${t("c.pulse.down", { count: stats.donePrev7 })}`
                  : `→ ${t("c.pulse.flat")}`}
            </div>
          </div>

          {/* Created vs completed bars */}
          <div className="mb-1 text-[10px] text-gray-500">
            {t("c.pulse.created")} <span className="text-purple-400">■</span> {t("c.pulse.vsCompleted")} <span className="text-emerald-400">■</span>
          </div>
          <div className="flex items-end gap-[2px] h-16 mb-4">
            {pulse.days.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col justify-end gap-[1px]" title={`${d.date}: +${d.created} / ✓${d.completed}`}>
                <div className="w-full bg-purple-500/70 rounded-sm" style={{ height: `${(d.created / maxBar) * 100}%` }} />
                <div className="w-full bg-emerald-500/70 rounded-sm" style={{ height: `${(d.completed / maxBar) * 100}%` }} />
              </div>
            ))}
          </div>

          {/* Open-count burndown */}
          <div className="mb-1 text-[10px] text-gray-500">{t("c.pulse.openTasks")}</div>
          <svg viewBox={`0 0 ${pulse.days.length} 40`} className="w-full h-14 mb-4" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="rgba(34, 211, 238, 0.8)"
              strokeWidth="1"
              points={stats.open.map((v, i) => `${i},${40 - (v / maxOpen) * 36 - 2}`).join(" ")}
            />
          </svg>

          {/* Churn meter */}
          <div className="mb-1 text-[10px] text-gray-500">{t("c.pulse.churn")}</div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-1">
            <div
              className={`h-full ${stats.churn > 8 ? "bg-red-500/70" : stats.churn > 4 ? "bg-amber-500/70" : "bg-emerald-500/70"}`}
              style={{ width: `${Math.min((stats.churn / 12) * 100, 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-gray-400 mb-4">
            {t("c.pulse.churnLine", {
              moved: stats.moved30,
              completed: stats.completed30,
              verdict: churnVerdict(stats.churn, stats.completed30),
            })}
          </div>

          {/* Per-bubble movement */}
          {bubbles.filter((b) => b.title).length > 0 && (
            <>
              <div className="mb-1.5 text-[10px] text-gray-500">{t("c.pulse.bubbles")}</div>
              <div className="flex flex-col gap-1.5">
                {bubbles
                  .filter((b) => b.title && b.memberIds.length >= 2)
                  .map((b) => {
                    const members = tasks.filter((t) => b.memberIds.includes(t.id));
                    const done = members.filter((t) => t.done).length;
                    return (
                      <button
                        key={b.id}
                        onClick={() => flyToBubble(b.memberIds)}
                        className="flex items-center gap-2 text-left group"
                        title={t("c.pulse.flyToBubble")}
                      >
                        <span className="text-xs text-gray-300 truncate flex-1 group-hover:text-white">{b.title}</span>
                        <span className="text-[10px] text-gray-500">{done}/{members.length}</span>
                        <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500/70"
                            style={{ width: members.length ? `${(done / members.length) * 100}%` : 0 }}
                          />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </>
          )}
        </>
      )}
    </motion.div>
  );
}
