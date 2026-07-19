import { useEffect, useRef } from "react";
import { useStore, CARD_W, CARD_H, type Task, type Waypoint } from "../store";
import type { Cluster } from "../engine/proximityDetector";
import { clusterHue } from "../utils/colors";
import { useT } from "../i18n";

const MAP_W = 192;
const MAP_H = 128;

interface MinimapProps {
  canvasId: string;
  tasks: Task[];
  clusters: Cluster[];
}

// Star-chart overview: task dots in their colors, bubbles as soft glows, and
// a draggable viewport rectangle. Hidden when everything already fits on screen.
export function Minimap({ canvasId, tasks, clusters }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvases = useStore((s) => s.canvases);
  const zoom = useStore((s) => s.zoom);
  const panX = useStore((s) => s.panX);
  const panY = useStore((s) => s.panY);
  const viewportW = useStore((s) => s.viewportW);
  const viewportH = useStore((s) => s.viewportH);
  const dragging = useRef(false);
  const t = useT();

  // World rect currently visible
  const viewL = -panX / zoom;
  const viewT = -panY / zoom;
  const viewR = viewL + viewportW / zoom;
  const viewB = viewT + viewportH / zoom;

  // Bounds = tasks ∪ viewport, padded
  let minX = viewL, minY = viewT, maxX = viewR, maxY = viewB;
  let allInView = true;
  for (const t of tasks) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + CARD_W);
    maxY = Math.max(maxY, t.y + CARD_H);
    if (t.x < viewL || t.x + CARD_W > viewR || t.y < viewT || t.y + CARD_H > viewB) {
      allInView = false;
    }
  }
  const pad = 150;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const scale = Math.min(MAP_W / (maxX - minX), MAP_H / (maxY - minY));
  const offX = (MAP_W - (maxX - minX) * scale) / 2;
  const offY = (MAP_H - (maxY - minY) * scale) / 2;
  const toMap = (wx: number, wy: number) => ({
    x: offX + (wx - minX) * scale,
    y: offY + (wy - minY) * scale,
  });

  const hidden = tasks.length === 0 || allInView;

  useEffect(() => {
    if (hidden) return;
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = MAP_W * dpr;
    el.height = MAP_H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, MAP_W, MAP_H);

    // Bubble glows
    const byId = new Map(tasks.map((t) => [t.id, t]));
    for (const cluster of clusters) {
      const members = cluster.members.map((id) => byId.get(id)).filter((t): t is Task => !!t);
      if (members.length < 2) continue;
      const cx = members.reduce((s, t) => s + t.x + CARD_W / 2, 0) / members.length;
      const cy = members.reduce((s, t) => s + t.y + CARD_H / 2, 0) / members.length;
      const spread = Math.max(...members.map((t) => Math.hypot(t.x + CARD_W / 2 - cx, t.y + CARD_H / 2 - cy)));
      const m = toMap(cx, cy);
      const r = Math.max((spread + 150) * scale, 8);
      const hue = clusterHue(cluster.id);
      const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
      grad.addColorStop(0, `hsla(${hue}, 85%, 60%, 0.35)`);
      grad.addColorStop(1, `hsla(${hue}, 85%, 60%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Task dots
    for (const t of tasks) {
      const m = toMap(t.x + CARD_W / 2, t.y + CARD_H / 2);
      ctx.fillStyle = t.done ? "rgba(148,163,184,0.5)" : t.color || "#8b5cf6";
      ctx.fillRect(m.x - 1.5, m.y - 1, 3, 2);
    }

    // Viewport rectangle
    const tl = toMap(viewL, viewT);
    const br = toMap(viewR, viewB);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  });

  if (hidden) return null;

  const canvasEntry = canvases.find((c) => c.id === canvasId);
  const waypoints: Waypoint[] = Array.isArray(canvasEntry?.viewpoints)
    ? (canvasEntry!.viewpoints as Waypoint[])
    : [];

  const centerAt = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = minX + (mx - offX) / scale;
    const wy = minY + (my - offY) / scale;
    const store = useStore.getState();
    store.setView(store.zoom, store.viewportW / 2 - wx * store.zoom, store.viewportH / 2 - wy * store.zoom);
  };

  return (
    <div className="absolute bottom-14 right-4 z-40">
      <canvas
        ref={canvasRef}
        style={{ width: MAP_W, height: MAP_H }}
        className="rounded-lg bg-[#0f0f13]/85 border border-white/15 shadow-xl cursor-pointer block"
        onPointerDown={(e) => {
          e.stopPropagation();
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          centerAt(e);
        }}
        onPointerMove={(e) => {
          if (dragging.current) centerAt(e);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        title={t("c.minimap.tooltip")}
      />
      {/* Waypoint pips (Shift+1..9 saves, 1..9 or click flies) */}
      {waypoints.length > 0 && (
        <div className="absolute -top-3 left-1 flex gap-1">
          {[...waypoints]
            .sort((a, b) => a.slot - b.slot)
            .map((wp) => (
              <button
                key={wp.slot}
                onClick={(e) => {
                  e.stopPropagation();
                  useStore.getState().gotoWaypoint(canvasId, wp.slot);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-5 h-5 rounded-full bg-[#1a1d24] border border-cyan-500/40 text-[9px] text-cyan-300 hover:border-cyan-300 transition-colors"
                title={t("c.minimap.waypoint", { slot: wp.slot })}
              >
                {wp.slot}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
