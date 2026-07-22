import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Cluster } from "../engine/proximityDetector";
import { api } from "../data/api";
import { useStore, bestBubbleMatch, CARD_W, CARD_H, type Task } from "../store";
import { clusterHue } from "../utils/colors";
import { formatMinutes, getCapacityHours } from "../utils/capacity";
import { BubbleXRay } from "./BubbleXRay";
import { useT } from "../i18n";

interface BubbleLayerProps {
  canvasId: string;
  clusters: Cluster[];
  tasks: Task[];
}

// Must match the card center used by the proximity detector.
const CARD_CX = 128;
const CARD_CY = 80;
// Small halo beyond the farthest card CORNER — the extent is measured for
// real now, so the ring hugs the content instead of over-covering neighbors.
const PADDING = 40;
const MIN_RADIUS = 180;

export function BubbleLayer({ canvasId, clusters, tasks }: BubbleLayerProps) {
  const t = useT();
  const serverBubbles = useStore((s) => s.bubbles);
  const readOnly = useStore((s) => s.readOnly);
  const focusActive = useStore((s) => s.focus !== null);
  const [editing, setEditing] = useState<string | null>(null); // cluster id being renamed
  const [draft, setDraft] = useState("");
  const [xray, setXray] = useState<string | null>(null); // cluster id with open x-ray
  const groupDrag = useRef<{
    pointerId: number;
    members: string[];
    lastX: number;
    lastY: number;
    start: Map<string, { x: number; y: number }>;
  } | null>(null);

  if (clusters.length === 0) return null;

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const capacityMinutes = getCapacityHours() * 60;

  const bubbles = clusters
    .map((cluster) => {
      const members = cluster.members
        .map((id) => byId.get(id))
        .filter((t): t is Task => !!t);
      if (members.length < 2) return null;

      const cx = members.reduce((s, t) => s + t.x + CARD_CX, 0) / members.length;
      const cy = members.reduce((s, t) => s + t.y + CARD_CY, 0) / members.length;
      // Farthest card corner, not center — a circle over centers clips wide
      // cards and needed a huge fixed padding that swallowed neighbors.
      const spread = Math.max(
        ...members.flatMap((t) => [
          Math.hypot(t.x - cx, t.y - cy),
          Math.hypot(t.x + CARD_W - cx, t.y - cy),
          Math.hypot(t.x - cx, t.y + CARD_H - cy),
          Math.hypot(t.x + CARD_W - cx, t.y + CARD_H - cy),
        ]),
      );
      const r = Math.max(spread + PADDING, MIN_RADIUS);
      const matched = bestBubbleMatch(serverBubbles, cluster.members);
      const hue = matched?.hue ?? clusterHue(cluster.id);
      const remaining = members
        .filter((t) => !t.done)
        .reduce((s, t) => s + (t.estimateMinutes ?? 0), 0);
      return { cluster, members, cx, cy, r, hue, matched, remaining };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  const saveTitle = (cluster: Cluster) => {
    setEditing(null);
    useStore
      .getState()
      .titleCluster(canvasId, cluster.members, draft.trim())
      .catch((e) => console.error(e));
  };

  const togglePin = (cluster: Cluster, matched: ReturnType<typeof bestBubbleMatch>, hue: number) => {
    const store = useStore.getState();
    if (matched?.pinned) {
      store.updateBubble(matched.id, { pinned: false }).catch((e) => console.error(e));
    } else {
      store
        .pinBubble(canvasId, cluster.members, matched?.title ?? "", hue)
        .catch((e) => console.error(e));
    }
  };

  // Whole-bubble drag from the ⠿ handle: all member cards move together.
  const startGroupDrag = (e: React.PointerEvent, members: string[]) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const tasksNow = useStore.getState().tasks;
    groupDrag.current = {
      pointerId: e.pointerId,
      members,
      lastX: e.clientX,
      lastY: e.clientY,
      start: new Map(
        tasksNow.filter((t) => members.includes(t.id)).map((t) => [t.id, { x: t.x, y: t.y }]),
      ),
    };
  };

  const moveGroupDrag = (e: React.PointerEvent) => {
    const d = groupDrag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const { zoom, moveTasksLocal } = useStore.getState();
    moveTasksLocal(d.members, (e.clientX - d.lastX) / zoom, (e.clientY - d.lastY) / zoom);
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  };

  const endGroupDrag = (e: React.PointerEvent) => {
    const d = groupDrag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    groupDrag.current = null;
    useStore.getState().commitClusterMove(d.members, d.start).catch((err) => console.error(err));
  };

  const pillStyle = (hue: number, alpha = 0.5) => ({
    border: `1.5px solid hsla(${hue}, 85%, 65%, ${alpha})`,
  });

  return (
    <>
      {/* 1x1 svg with visible overflow lets us draw at any world coordinate. */}
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width="1"
        height="1"
        style={{ overflow: "visible" }}
      >
        <defs>
          <filter id="bubble-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" />
          </filter>
        </defs>

        <AnimatePresence>
          {bubbles.map(({ cluster, cx, cy, r, hue, matched }) => (
            <motion.g
              key={cluster.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <circle
                className="bubble-pulse"
                cx={cx}
                cy={cy}
                r={r}
                fill={`hsla(${hue}, 85%, 65%, 0.07)`}
                filter="url(#bubble-glow)"
              />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={`hsla(${hue}, 85%, 60%, 0.08)`}
                stroke={`hsla(${hue}, 85%, 65%, ${matched?.pinned ? 0.75 : 0.4})`}
                strokeWidth={matched?.pinned ? 2.5 : 1.5}
                strokeDasharray={matched?.pinned ? undefined : "1 0"}
              />
            </motion.g>
          ))}
        </AnimatePresence>
      </svg>

      {/* Bubble chrome: handle, count, title, workload, and actions */}
      {bubbles.map(({ cluster, members, cx, cy, r, hue, matched, remaining }) => {
        const title = matched?.title || null;
        const isEditing = editing === cluster.id;
        const overCapacity = remaining > 0 ? Math.min(remaining / capacityMinutes, 1) : 0;
        const checklistTotal = members.reduce((s, t) => s + t.checklist.length, 0);
        const checklistDone = members.reduce(
          (s, t) => s + t.checklist.filter((c) => c.done).length,
          0,
        );

        return (
          <div
            key={cluster.id}
            className="absolute flex items-center gap-1"
            style={{
              left: cx,
              top: cy - r,
              transform: "translate(-50%, -50%)",
              pointerEvents: "auto",
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {/* Group-drag handle */}
            {!readOnly && (
            <span
              onPointerDown={(e) => startGroupDrag(e, cluster.members)}
              onPointerMove={moveGroupDrag}
              onPointerUp={endGroupDrag}
              onPointerCancel={endGroupDrag}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1a1d24] text-[11px] text-gray-400 cursor-grab active:cursor-grabbing select-none"
              style={pillStyle(hue)}
              title={t("b.bubble.dragWhole")}
            >
              ⠿
            </span>
            )}

            {/* Count → X-ray */}
            <button
              onClick={() => setXray(xray === cluster.id ? null : cluster.id)}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1a1d24] text-[11px] text-gray-200 hover:text-white shrink-0"
              style={pillStyle(hue)}
              title={t("b.bubble.xrayTitle")}
            >
              {members.length}
            </button>

            {/* Title (inline edit) */}
            {readOnly ? (
              title && (
                <span
                  className="h-6 px-2.5 rounded-full bg-[#1a1d24] text-[11px] text-gray-100 flex items-center whitespace-nowrap"
                  style={pillStyle(hue)}
                >
                  {title}
                </span>
              )
            ) : isEditing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => saveTitle(cluster)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") saveTitle(cluster);
                  if (e.key === "Escape") setEditing(null);
                }}
                className="h-6 w-36 px-2 rounded-full bg-[#0f0f13] text-[11px] text-gray-100 outline-none"
                style={pillStyle(hue)}
              />
            ) : (
              <button
                onClick={() => {
                  setDraft(title ?? "");
                  setEditing(cluster.id);
                }}
                className={`h-6 px-2.5 rounded-full bg-[#1a1d24] text-[11px] whitespace-nowrap transition-colors ${
                  title ? "text-gray-100" : "text-gray-500 italic hover:text-gray-300"
                }`}
                style={pillStyle(hue)}
                title={t("b.bubble.rename")}
              >
                {title ?? t("b.bubble.namePlaceholder")}
              </button>
            )}

            {/* Pin */}
            {!readOnly && (
            <button
              onClick={() => togglePin(cluster, matched, hue)}
              className={`h-6 px-1.5 rounded-full bg-[#1a1d24] text-[11px] transition-colors ${
                matched?.pinned ? "text-amber-300" : "text-gray-500 hover:text-gray-300"
              }`}
              style={pillStyle(hue, matched?.pinned ? 0.75 : 0.35)}
              title={matched?.pinned ? t("b.bubble.unpin") : t("b.bubble.pin")}
            >
              {matched?.pinned ? "★" : "☆"}
            </button>
            )}

            {/* Workload */}
            {remaining > 0 && (
              <span
                className="h-6 px-2 rounded-full bg-[#1a1d24] text-[10px] text-gray-300 flex items-center whitespace-nowrap"
                style={{
                  border: `1.5px solid hsla(${Math.round(190 - 190 * overCapacity)}, 85%, 60%, 0.6)`,
                }}
                title={t("b.bubble.workload", { hours: getCapacityHours() })}
              >
                Σ {formatMinutes(remaining)}
              </span>
            )}

            {/* Checklist aggregate */}
            {checklistTotal > 0 && (
              <span
                className="h-6 px-2 rounded-full bg-[#1a1d24] text-[10px] text-gray-400 flex items-center whitespace-nowrap"
                style={pillStyle(hue, 0.35)}
              >
                ☑ {checklistDone}/{checklistTotal}
              </span>
            )}

            {/* Arrange / pack / focus */}
            {!readOnly && (<>
            <button
              onClick={() => useStore.getState().arrangeCluster(cluster.members, "due").catch((e) => console.error(e))}
              className="h-6 px-2 rounded-full bg-[#1a1d24] text-[10px] text-gray-400 hover:text-white whitespace-nowrap transition-colors"
              style={pillStyle(hue, 0.35)}
              title={t("b.bubble.arrangeDue")}
            >
              ⇅ {t("b.bubble.pill.due")}
            </button>
            <button
              onClick={() => useStore.getState().arrangeCluster(cluster.members, "priority").catch((e) => console.error(e))}
              className="h-6 px-2 rounded-full bg-[#1a1d24] text-[10px] text-gray-400 hover:text-white whitespace-nowrap transition-colors"
              style={pillStyle(hue, 0.35)}
              title={t("b.bubble.arrangePrio")}
            >
              ⇅ {t("b.bubble.pill.prio")}
            </button>
            <button
              onClick={() => useStore.getState().packCluster(cluster.members).catch((e) => console.error(e))}
              className="h-6 px-2 rounded-full bg-[#1a1d24] text-[10px] text-gray-400 hover:text-white whitespace-nowrap transition-colors"
              style={pillStyle(hue, 0.35)}
              title={t("b.bubble.pack")}
            >
              ⬡
            </button>
            <button
              onClick={() => {
                const store = useStore.getState();
                if (store.focus) store.exitFocus();
                else store.startFocus(cluster.members);
              }}
              className="h-6 px-2 rounded-full bg-[#1a1d24] text-[10px] text-cyan-400/80 hover:text-cyan-300 whitespace-nowrap transition-colors"
              style={pillStyle(hue, 0.35)}
              title={t("b.bubble.focusTitle")}
            >
              {focusActive ? `■ ${t("b.bubble.exit")}` : `▶ ${t("b.bubble.focus")}`}
            </button>
            <button
              onClick={() => {
                const name = prompt(t("b.bubble.savePrompt"), title ?? "");
                if (!name) return;
                const bx = members.reduce((s, t) => s + t.x, 0) / members.length;
                const by = members.reduce((s, t) => s + t.y, 0) / members.length;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                api
                  .createTemplate({
                    name,
                    kind: "bubble",
                    payload: {
                      title: title ?? name,
                      items: members.map((t) => ({
                        dx: t.x - bx,
                        dy: t.y - by,
                        title: t.title,
                        description: t.description,
                        tags: t.tags,
                        color: t.color,
                        priority: t.priority,
                        estimateMinutes: t.estimateMinutes ?? undefined,
                        dueInDays: t.dueDate
                          ? Math.max(
                              0,
                              Math.round((new Date(t.dueDate).setHours(0, 0, 0, 0) - today.getTime()) / 86_400_000),
                            )
                          : undefined,
                      })),
                    },
                  })
                  .then(() => useStore.getState().showToast(t("b.bubble.savedToast", { name })))
                  .catch((e) => console.error(e));
              }}
              className="h-6 px-2 rounded-full bg-[#1a1d24] text-[10px] text-gray-400 hover:text-amber-300 whitespace-nowrap transition-colors"
              style={pillStyle(hue, 0.35)}
              title={t("b.bubble.saveTitle")}
            >
              ✦ {t("b.bubble.save")}
            </button>
            </>)}

            {xray === cluster.id && (
              <BubbleXRay
                canvasId={canvasId}
                members={members}
                hue={hue}
                onClose={() => setXray(null)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
