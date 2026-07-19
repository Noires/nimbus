import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, type Task } from "../data/api";
import { CARD_W, CARD_H } from "../store";
import { localDayKey } from "../utils/capacity";
import { useT } from "../i18n";

// 60s module-level cache so hovering back and forth doesn't hammer the API.
const cache = new Map<string, { at: number; tasks: Task[] }>();

async function peekTasks(canvasId: string): Promise<Task[]> {
  const hit = cache.get(canvasId);
  if (hit && Date.now() - hit.at < 60_000) return hit.tasks;
  const { tasks } = await api.listTasks(canvasId);
  cache.set(canvasId, { at: Date.now(), tasks });
  return tasks;
}

/** Prop-driven dot-field miniature of a board (shared mini-renderer). */
export function MiniField({ tasks, width = 200, height = 120 }: { tasks: Task[]; width?: number; height?: number }) {
  const t = useT();
  if (tasks.length === 0) {
    return <div className="flex items-center justify-center text-[10px] text-gray-600" style={{ width, height }}>{t("c.portalPeek.emptyBoard")}</div>;
  }
  const pad = 150;
  const minX = Math.min(...tasks.map((t) => t.x)) - pad;
  const maxX = Math.max(...tasks.map((t) => t.x + CARD_W)) + pad;
  const minY = Math.min(...tasks.map((t) => t.y)) - pad;
  const maxY = Math.max(...tasks.map((t) => t.y + CARD_H)) + pad;
  const scale = Math.min(width / (maxX - minX), height / (maxY - minY));
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;

  return (
    <svg width={width} height={height}>
      {tasks.map((t) => (
        <circle
          key={t.id}
          cx={offX + (t.x + CARD_W / 2 - minX) * scale}
          cy={offY + (t.y + CARD_H / 2 - minY) * scale}
          r={2}
          fill={t.done ? "rgba(148,163,184,0.4)" : t.color || "#8b5cf6"}
        />
      ))}
    </svg>
  );
}

// Hover a portal → holographic preview of where it leads.
export function PortalPeek({ targetCanvasId, targetName }: { targetCanvasId: string; targetName: string }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    peekTasks(targetCanvasId)
      .then((t) => !cancelled && setTasks(t))
      .catch(() => !cancelled && setTasks([]));
    return () => {
      cancelled = true;
    };
  }, [targetCanvasId]);

  const open = tasks?.filter((t) => !t.done && !t.archivedAt && !t.inbox) ?? [];
  const todayKey = localDayKey(new Date());
  const weekAhead = localDayKey(new Date(Date.now() + 7 * 86_400_000));
  const dueThisWeek = open.filter(
    (t) => t.dueDate && localDayKey(t.dueDate) >= todayKey && localDayKey(t.dueDate) <= weekAhead,
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="absolute left-1/2 bottom-24 -translate-x-1/2 z-50 rounded-xl bg-[#0f0f13]/95 backdrop-blur-xl border border-cyan-500/30 shadow-2xl p-2.5 pointer-events-none"
      style={{ width: 220 }}
    >
      <div className="text-[11px] text-gray-200 mb-1 truncate">◍ {targetName}</div>
      {tasks === null ? (
        <div className="text-[10px] text-gray-600 py-8 text-center">{t("c.portalPeek.peering")}</div>
      ) : (
        <>
          <MiniField tasks={tasks.filter((t) => !t.inbox && !t.archivedAt)} width={200} height={110} />
          <div className="text-[10px] text-gray-500 mt-1">
            {t("c.portalPeek.open", { count: open.length })}
            {dueThisWeek ? ` · ${t("c.portalPeek.dueThisWeek", { count: dueThisWeek })}` : ""}
          </div>
        </>
      )}
    </motion.div>
  );
}
