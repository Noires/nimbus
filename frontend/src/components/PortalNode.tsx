import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../data/api";
import { useStore, type Portal } from "../store";
import { clusterHue } from "../utils/colors";
import { PortalPeek } from "./PortalPeek";
import { useT } from "../i18n";

// A shimmering ring on the canvas that leads to another board. Drop a card on
// it to send the card through; double-click to travel there yourself.
export function PortalNode({ portal }: { portal: Portal }) {
  const draggingTaskId = useStore((s) => s.draggingTaskId);
  const navigate = useNavigate();
  const drag = useRef<{ pointerId: number; startX: number; startY: number; px: number; py: number } | null>(null);
  const hue = clusterHue(portal.targetCanvasId);
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useT();

  useEffect(() => () => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, px: portal.x, py: portal.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const { zoom, portals } = useStore.getState();
    const x = d.px + (e.clientX - d.startX) / zoom;
    const y = d.py + (e.clientY - d.startY) / zoom;
    useStore.setState({ portals: portals.map((p) => (p.id === portal.id ? { ...p, x, y } : p)) });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    const current = useStore.getState().portals.find((p) => p.id === portal.id);
    if (!current || (current.x === d.px && current.y === d.py)) return;
    api.updatePortal(portal.id, { x: current.x, y: current.y }).catch((err) => console.error(err));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: draggingTaskId ? 1.15 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="absolute group cursor-grab active:cursor-grabbing"
      style={{ left: portal.x - 44, top: portal.y - 44, width: 88, height: 88 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={() => {
        peekTimer.current = setTimeout(() => setPeek(true), 350);
      }}
      onPointerLeave={() => {
        if (peekTimer.current) clearTimeout(peekTimer.current);
        setPeek(false);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        navigate(`/canvas/${portal.targetCanvasId}`);
      }}
      title={t("c.portal.tooltip", { name: portal.target?.name ?? "?" })}
    >
      {peek && !draggingTaskId && (
        <PortalPeek targetCanvasId={portal.targetCanvasId} targetName={portal.target?.name ?? "?"} />
      )}
      <div
        className="absolute inset-0 rounded-full bubble-pulse"
        style={{
          border: `3px solid hsla(${hue}, 85%, 65%, ${draggingTaskId ? 0.95 : 0.6})`,
          boxShadow: `0 0 24px 4px hsla(${hue}, 85%, 60%, ${draggingTaskId ? 0.5 : 0.25}), inset 0 0 24px hsla(${hue}, 85%, 60%, 0.3)`,
          background: `radial-gradient(circle, hsla(${hue}, 85%, 55%, 0.25), hsla(${hue}, 85%, 55%, 0.02) 70%)`,
        }}
      />
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 whitespace-nowrap px-1.5 py-0.5 rounded bg-[#0f0f13]/70">
        ◍ {portal.target?.name ?? "?"}
      </div>
      <button
        onClick={() => {
          if (confirm(t("c.portal.removeConfirm"))) {
            useStore.getState().removePortal(portal.id).catch((err) => console.error(err));
          }
        }}
        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#1a1d24] border border-white/20 text-gray-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
      >
        ×
      </button>
    </motion.div>
  );
}
