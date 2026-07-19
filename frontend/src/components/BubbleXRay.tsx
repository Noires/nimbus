import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../data/api";
import { useStore, CARD_W, CARD_H, type Task } from "../store";
import { formatMinutes } from "../utils/capacity";
import { useT } from "../i18n";

interface BubbleXRayProps {
  canvasId: string;
  members: Task[];
  hue: number;
  onClose: () => void;
}

// Compact per-cluster insight popover: due pressure, priority mix, progress,
// workload, and 7-day momentum.
export function BubbleXRay({ canvasId, members, hue, onClose }: BubbleXRayProps) {
  const t = useT();
  const [momentum, setMomentum] = useState<number | null>(null);
  const readOnly = useStore((s) => s.readOnly);

  useEffect(() => {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const ids = new Set(members.map((m) => m.id));
    api
      .canvasEvents(canvasId, since)
      .then(({ events }) =>
        setMomentum(events.filter((e) => e.type === "completed" && ids.has(e.taskId)).length),
      )
      .catch(() => setMomentum(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  const doneCount = members.filter((m) => m.done).length;
  const remaining = members.filter((m) => !m.done).reduce((s, m) => s + (m.estimateMinutes ?? 0), 0);
  const prio = { high: 0, medium: 0, low: 0 } as Record<string, number>;
  for (const m of members) prio[m.priority] = (prio[m.priority] ?? 0) + 1;

  // 4-week due strip: one cell per day, count of members due that day.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayCells: number[] = new Array(28).fill(0);
  let overdueCount = 0;
  let undatedCount = 0;
  for (const m of members) {
    if (m.done) continue;
    if (!m.dueDate) {
      undatedCount++;
      continue;
    }
    const days = Math.round((new Date(m.dueDate).setHours(0, 0, 0, 0) - today.getTime()) / 86_400_000);
    if (days < 0) overdueCount++;
    else if (days < 28) dayCells[days]++;
  }

  const fitToBubble = () => {
    const store = useStore.getState();
    const margin = 80;
    const minX = Math.min(...members.map((t) => t.x)) - margin;
    const maxX = Math.max(...members.map((t) => t.x + CARD_W)) + margin;
    const minY = Math.min(...members.map((t) => t.y)) - margin;
    const maxY = Math.max(...members.map((t) => t.y + CARD_H)) + margin;
    const zoom = Math.min(
      Math.max(Math.min(store.viewportW / (maxX - minX), store.viewportH / (maxY - minY)), 0.2),
      1.5,
    );
    store.setView(
      zoom,
      (store.viewportW - (maxX - minX) * zoom) / 2 - minX * zoom,
      (store.viewportH - (maxY - minY) * zoom) / 2 - minY * zoom,
    );
    onClose();
  };

  const donePct = Math.round((doneCount / members.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="absolute top-8 left-0 z-50 w-72 rounded-xl bg-[#0f0f13]/95 backdrop-blur-xl p-4 shadow-2xl"
      style={{ border: `1.5px solid hsla(${hue}, 85%, 65%, 0.4)` }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-200">{t("b.xray.title")}</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-sm leading-none">×</button>
      </div>

      {/* Progress + momentum */}
      <div className="flex items-center gap-4 mb-3">
        <div>
          <div className="text-lg font-semibold text-gray-100">{donePct}%</div>
          <div className="text-[10px] text-gray-500">{doneCount}/{members.length} {t("b.xray.done")}</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-100">
            {momentum === null ? "–" : momentum}
          </div>
          <div className="text-[10px] text-gray-500">{t("b.xray.doneLast7d")}</div>
        </div>
        {remaining > 0 && (
          <div>
            <div className="text-lg font-semibold text-gray-100">{formatMinutes(remaining)}</div>
            <div className="text-[10px] text-gray-500">{t("b.xray.remaining")}</div>
          </div>
        )}
        {members.some((m) => m.actualMinutes > 0) && (
          <div>
            <div className="text-lg font-semibold text-gray-100">
              {formatMinutes(members.reduce((s, m) => s + m.actualMinutes, 0))}
            </div>
            <div className="text-[10px] text-gray-500">{t("b.xray.actualLogged")}</div>
          </div>
        )}
      </div>

      {/* Priority mix */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-500 mb-1">{t("b.xray.priorityMix")}</div>
        <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
          {prio.high > 0 && (
            <div className="bg-red-500/70" style={{ width: `${(prio.high / members.length) * 100}%` }} />
          )}
          {prio.medium > 0 && (
            <div className="bg-yellow-500/70" style={{ width: `${(prio.medium / members.length) * 100}%` }} />
          )}
          {prio.low > 0 && (
            <div className="bg-green-500/70" style={{ width: `${(prio.low / members.length) * 100}%` }} />
          )}
        </div>
        <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
          <span>● {prio.high} {t("b.xray.high")}</span>
          <span>● {prio.medium} {t("b.xray.med")}</span>
          <span>● {prio.low} {t("b.xray.low")}</span>
        </div>
      </div>

      {/* 4-week due strip */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-500 mb-1">
          {t("b.xray.dueNext4Weeks")}
          {overdueCount > 0 && <span className="text-red-400"> · {t("b.xray.overdue", { n: overdueCount })}</span>}
          {undatedCount > 0 && <span> · {t("b.xray.undated", { n: undatedCount })}</span>}
        </div>
        <div className="flex gap-[2px]">
          {dayCells.map((count, i) => (
            <div
              key={i}
              title={t("b.xray.dayCell", { n: i, count })}
              className="h-4 flex-1 rounded-sm"
              style={{
                background:
                  count === 0
                    ? "rgba(255,255,255,0.05)"
                    : `hsla(${hue}, 85%, 60%, ${Math.min(0.25 + count * 0.25, 1)})`,
              }}
            />
          ))}
        </div>
      </div>

      <button
        onClick={fitToBubble}
        className="w-full py-1.5 rounded-lg text-xs text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/10 transition-colors"
      >
        {t("b.xray.fitView")}
      </button>
      {!readOnly && undatedCount > 0 && (
        <button
          onClick={() => {
            const ids = members.filter((m) => !m.done && !m.dueDate).map((m) => m.id);
            useStore.getState().autoScheduleTasks(ids).catch((e) => console.error(e));
            onClose();
          }}
          className="w-full mt-1.5 py-1.5 rounded-lg text-xs text-purple-300 border border-purple-500/30 hover:bg-purple-500/10 transition-colors"
          title={t("b.xray.flowFillTitle")}
        >
          ⇶ {t("b.xray.flowFill", { n: undatedCount })}
        </button>
      )}
      {!readOnly && members.some((m) => !m.done) && (
        <button
          onClick={() => {
            const ids = members.filter((m) => !m.done).map((m) => m.id);
            useStore.getState().mergeTasksAction(ids).catch((e) => console.error(e));
            onClose();
          }}
          className="w-full mt-1.5 py-1.5 rounded-lg text-xs text-gray-400 border border-white/10 hover:bg-white/5 transition-colors"
          title={t("b.xray.mergeTitle")}
        >
          ⇢ {t("b.xray.merge")}
        </button>
      )}
    </motion.div>
  );
}
