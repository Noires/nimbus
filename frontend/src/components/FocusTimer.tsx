import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../store";
import { formatMinutes } from "../utils/capacity";
import { useT } from "../i18n";

const POMODORO_MS = 25 * 60 * 1000;

// Pomodoro HUD for focus mode: banks real minutes onto the focused task so
// estimate-vs-actual stops being fiction.
export function FocusTimer() {
  const focus = useStore((s) => s.focus);
  const tasks = useStore((s) => s.tasks);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const baseRef = useRef(0);
  const t = useT();

  const current = focus ? tasks.find((t) => t.id === focus.members[focus.index]) : null;

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setElapsed(baseRef.current + (Date.now() - startRef.current)), 1000);
    return () => clearInterval(interval);
  }, [running]);

  // Reset when focus session ends or moves to another card.
  useEffect(() => {
    setRunning(false);
    setElapsed(0);
    baseRef.current = 0;
  }, [focus?.members, focus?.index]);

  if (!focus || !current) return null;

  const start = () => {
    startRef.current = Date.now();
    setRunning(true);
  };
  const pause = () => {
    baseRef.current = elapsed;
    setRunning(false);
  };
  const bank = () => {
    pause();
    const minutes = Math.round(elapsed / 60_000);
    setElapsed(0);
    baseRef.current = 0;
    if (minutes < 1) return;
    const store = useStore.getState();
    // Real time is not undoable — bypass history on purpose.
    store
      .patchTask(current.id, { actualMinutes: current.actualMinutes + minutes }, { record: false })
      .then(() => store.showToast(t("c.focus.banked", { minutes: formatMinutes(minutes), title: current.title })))
      .catch((e) => console.error(e));
  };

  const progress = Math.min(elapsed / POMODORO_MS, 1);
  const mm = Math.floor(elapsed / 60_000);
  const ss = Math.floor((elapsed % 60_000) / 1000);
  const overEstimate =
    current.estimateMinutes != null &&
    current.actualMinutes + elapsed / 60_000 > current.estimateMinutes;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 rounded-xl bg-[#1a1d24]/95 backdrop-blur-md border border-cyan-500/30 px-4 py-2 shadow-2xl"
    >
      <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90 shrink-0">
        <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle
          cx="14" cy="14" r="12" fill="none"
          stroke={progress >= 1 ? "#f59e0b" : "#22d3ee"}
          strokeWidth="3"
          strokeDasharray={`${progress * 75.4} 75.4`}
          strokeLinecap="round"
        />
      </svg>
      <span className={`text-sm tabular-nums ${progress >= 1 ? "text-amber-300" : "text-gray-200"}`}>
        {mm}:{String(ss).padStart(2, "0")}
      </span>
      {!running ? (
        <button onClick={start} className="text-xs text-cyan-300 hover:text-cyan-200 transition-colors">
          ▶ {elapsed > 0 ? t("c.focus.resume") : t("c.focus.start")}
        </button>
      ) : (
        <button onClick={pause} className="text-xs text-gray-300 hover:text-white transition-colors">
          ⏸ {t("c.focus.pause")}
        </button>
      )}
      {elapsed >= 60_000 && (
        <button onClick={bank} className="text-xs text-emerald-300 hover:text-emerald-200 transition-colors">
          ⏹ {t("c.focus.bank", { minutes: Math.round(elapsed / 60_000) })}
        </button>
      )}
      <span className="text-[10px] text-gray-500 whitespace-nowrap">
        {current.estimateMinutes != null && (
          <>
            {t("c.focus.est")} {formatMinutes(current.estimateMinutes)} · {t("c.focus.act")}{" "}
            <span className={overEstimate ? "text-orange-400" : ""}>
              {formatMinutes(Math.round(current.actualMinutes + elapsed / 60_000))}
            </span>
          </>
        )}
      </span>

      <div className="w-px h-5 bg-white/10" />
      <span className="text-[10px] text-gray-500 whitespace-nowrap">
        {t("c.focus.session", { index: focus.index + 1, total: focus.members.length })} ·{" "}
        <kbd className="px-1 rounded bg-white/10 text-gray-400">J/K</kbd> {t("c.focus.nextPrev")} ·{" "}
        <kbd className="px-1 rounded bg-white/10 text-gray-400">D</kbd> {t("c.focus.done")} ·{" "}
        <kbd className="px-1 rounded bg-white/10 text-gray-400">E</kbd> {t("c.focus.edit")}
      </span>
      <button
        onClick={() => useStore.getState().exitFocus()}
        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors whitespace-nowrap"
        title={t("c.focus.exitTooltip")}
      >
        <kbd className="px-1 rounded bg-white/10">Esc</kbd> {t("c.focus.exit")} ×
      </button>
    </motion.div>
  );
}
