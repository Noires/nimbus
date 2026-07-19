import { useEffect, useRef, useState } from "react";
import { useStore, visibleTasks, matchesSearch, CARD_W, CARD_H, type Task } from "../store";
import { useClusters } from "../engine/proximityDetector";
import { TaskCard } from "./TaskCard";
import { TaskChip } from "./TaskChip";
import { BubbleLayer } from "./BubbleLayer";
import { EdgeLayer } from "./EdgeLayer";
import { ZoneLayer } from "./ZoneLayer";
import { TimeAxis } from "./TimeAxis";
import { Minimap } from "./Minimap";
import { PortalNode } from "./PortalNode";
import { localDayKey } from "../utils/capacity";
import { useT } from "../i18n";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

type LodBand = "full" | "chip" | "dot";

// Hysteresis bands so the card/chip/dot boundary never flickers while zooming.
function nextLodBand(zoom: number, prev: LodBand): LodBand {
  if (prev === "full") return zoom < 0.22 ? "dot" : zoom < 0.42 ? "chip" : "full";
  if (prev === "chip") return zoom > 0.48 ? "full" : zoom < 0.22 ? "dot" : "chip";
  return zoom > 0.48 ? "full" : zoom > 0.28 ? "chip" : "dot";
}

interface CanvasProps {
  canvasId: string;
  onCreateAt: (x: number, y: number) => void;
  onEditTask: (task: Task) => void;
}

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function Canvas({ canvasId, onCreateAt, onEditTask }: CanvasProps) {
  const tasks = useStore((s) => s.tasks);
  const dependencies = useStore((s) => s.dependencies);
  const showDone = useStore((s) => s.showDone);
  const showArchived = useStore((s) => s.showArchived);
  const searchQuery = useStore((s) => s.searchQuery);
  const dayFilter = useStore((s) => s.dayFilter);
  const focus = useStore((s) => s.focus);
  const review = useStore((s) => s.review);
  const portals = useStore((s) => s.portals);
  const replay = useStore((s) => s.replayTasks);
  const selectedIds = useStore((s) => s.selectedIds);
  const zoneDraw = useStore((s) => s.zoneDraw);
  const readOnly = useStore((s) => s.readOnly);
  const zoom = useStore((s) => s.zoom);
  const panX = useStore((s) => s.panX);
  const panY = useStore((s) => s.panY);
  const viewportW = useStore((s) => s.viewportW);
  const viewportH = useStore((s) => s.viewportH);
  const setView = useStore((s) => s.setView);
  const t = useT();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [zoneRect, setZoneRect] = useState<Rect | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const bandRef = useRef<LodBand>("full");
  const clusters = useClusters();

  // Load everything canvas-scoped when the canvas changes.
  useEffect(() => {
    if (readOnly) return; // share view hydrates via loadSharedSnapshot
    const store = useStore.getState();
    store.refreshTasks(canvasId).catch((e) => console.error(e));
    store.loadBubbles(canvasId).catch((e) => console.error(e));
    store.loadDependencies(canvasId).catch((e) => console.error(e));
    store.loadPortals(canvasId).catch((e) => console.error(e));
    store.loadZones(canvasId).catch((e) => console.error(e));
    store.loadConnections(canvasId).catch((e) => console.error(e));
  }, [canvasId, readOnly]);

  // Track viewport size for flyTo / fitView / zoom-around-center.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => useStore.getState().setViewport(el.clientWidth, el.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Wheel zoom around the cursor. Native listener because React attaches wheel
  // handlers passively at the root, which makes preventDefault a no-op.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, panX, panY, setView } = useStore.getState();
      const next = Math.min(Math.max(zoom * Math.exp(-e.deltaY * 0.001), MIN_ZOOM), MAX_ZOOM);
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // Keep the world point under the cursor fixed: screen = world * zoom + pan.
      const k = next / zoom;
      setView(next, cx - (cx - panX) * k, cy - (cy - panY) * k);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toWorld = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const { zoom, panX, panY } = useStore.getState();
    return { x: (clientX - rect.left - panX) / zoom, y: (clientY - rect.top - panY) / zoom };
  };

  // Background pointer: zone drawing > marquee (Shift) > pan.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (zoneDraw && !readOnly) {
      const w = toWorld(e.clientX, e.clientY);
      setZoneRect({ x1: w.x, y1: w.y, x2: w.x, y2: w.y });
      return;
    }
    if (e.shiftKey && !readOnly) {
      const w = toWorld(e.clientX, e.clientY);
      setMarquee({ x1: w.x, y1: w.y, x2: w.x, y2: w.y });
      return;
    }
    setIsPanning(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const store = useStore.getState();
    if (store.linking) {
      const w = toWorld(e.clientX, e.clientY);
      store.setLinking({ ...store.linking, x: w.x, y: w.y });
      return;
    }
    if (zoneRect) {
      const w = toWorld(e.clientX, e.clientY);
      setZoneRect({ ...zoneRect, x2: w.x, y2: w.y });
      return;
    }
    if (marquee) {
      const w = toWorld(e.clientX, e.clientY);
      setMarquee({ ...marquee, x2: w.x, y2: w.y });
      return;
    }
    if (!isPanning) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setView(zoom, panX + dx, panY + dy);
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    const store = useStore.getState();
    if (store.linking) store.setLinking(null);

    if (zoneRect) {
      const rect = normalizeRect(zoneRect);
      setZoneRect(null);
      store.setZoneDraw(false);
      if (rect.w > 160 && rect.h > 120) {
        const label = prompt(t("c.canvas.zoneLabelPrompt"), "") ?? "";
        store
          .addZone({ canvasId, x: rect.x, y: rect.y, w: rect.w, h: rect.h, label, hue: Math.floor(Math.random() * 360) })
          .catch((err) => console.error(err));
      }
      return;
    }

    if (marquee) {
      const rect = normalizeRect(marquee);
      setMarquee(null);
      const hits = visibleTasks(store.tasks, store.showDone, store.showArchived)
        .filter(
          (t) =>
            t.x < rect.x + rect.w && t.x + CARD_W > rect.x &&
            t.y < rect.y + rect.h && t.y + CARD_H > rect.y,
        )
        .map((t) => t.id);
      if (hits.length) {
        store.setSelected([...new Set([...store.selectedIds, ...hits])]);
      }
      return;
    }
  };

  // Double-click on empty canvas creates a task there (cards stop propagation
  // and open the edit dialog instead).
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    const w = toWorld(e.clientX, e.clientY);
    onCreateAt(w.x - 128, w.y - 80);
  };

  const shown = visibleTasks(tasks, showDone, showArchived);

  // Viewport culling: skip cards far outside the visible world rect.
  const cullMargin = 400;
  const viewL = -panX / zoom - cullMargin;
  const viewT = -panY / zoom - cullMargin;
  const viewR = (viewportW - panX) / zoom + cullMargin;
  const viewB = (viewportH - panY) / zoom + cullMargin;
  const inView = (t: Task) =>
    t.x + CARD_W > viewL && t.x < viewR && t.y + CARD_H > viewT && t.y < viewB;

  const band = nextLodBand(zoom, bandRef.current);
  bandRef.current = band;

  // Blocked = some not-done blocker points at this task.
  const doneById = new Map(tasks.map((t) => [t.id, t.done]));
  const blockedSet = new Set(
    dependencies.filter((d) => doneById.get(d.blockerId) === false).map((d) => d.blockedId),
  );

  const focusMembers = focus ? new Set(focus.members) : null;
  const focusCurrent = focus ? focus.members[focus.index] : null;
  const reviewCurrent = review ? review.queue[review.index] : null;
  const selectedSet = new Set(selectedIds);

  const isDimmed = (task: Task) =>
    !matchesSearch(task, searchQuery) ||
    (focusMembers ? !focusMembers.has(task.id) : false) ||
    (reviewCurrent ? reviewCurrent !== task.id : false) ||
    (dayFilter ? !(task.dueDate && localDayKey(task.dueDate) === dayFilter) : false);

  const marqueeRect = marquee ? normalizeRect(marquee) : zoneRect ? normalizeRect(zoneRect) : null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${
        zoneDraw ? "cursor-crosshair" : isPanning ? "cursor-grabbing" : "cursor-grab"
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Grid background synced to the view transform */}
      <div
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${panX}px ${panY}px`,
        }}
      />

      {/* World layer */}
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <ZoneLayer />
        <TimeAxis />
        <BubbleLayer canvasId={canvasId} clusters={clusters} tasks={replay ?? shown} />
        {!replay && band === "full" && <EdgeLayer tasks={shown} />}
        {!replay && portals.map((portal) => <PortalNode key={portal.id} portal={portal} />)}

        {replay
          ? replay.map((ghost) => (
              <div
                key={ghost.id}
                className="absolute w-64 rounded-xl bg-[#1a1d24]/80 border border-white/10 shadow-lg"
                style={{ left: ghost.x, top: ghost.y, opacity: ghost.done ? 0.4 : 0.85 }}
              >
                <div className="h-2 rounded-t-xl" style={{ background: ghost.color }} />
                <div className="px-3 py-2 text-xs text-gray-300 truncate">
                  {ghost.done ? "✓ " : ""}
                  {ghost.title}
                </div>
              </div>
            ))
          : shown.filter(inView).map((task) =>
              band === "full" ? (
                <TaskCard
                  key={task.id}
                  task={task}
                  dimmed={isDimmed(task)}
                  blocked={blockedSet.has(task.id)}
                  focused={focusCurrent === task.id}
                  selected={selectedSet.has(task.id)}
                  onEdit={onEditTask}
                />
              ) : (
                <TaskChip key={task.id} task={task} dot={band === "dot"} dimmed={isDimmed(task)} />
              ),
            )}

        {/* Marquee / zone-draw rectangle */}
        {marqueeRect && (
          <div
            className="absolute rounded-lg pointer-events-none"
            style={{
              left: marqueeRect.x,
              top: marqueeRect.y,
              width: marqueeRect.w,
              height: marqueeRect.h,
              border: zoneRect ? "2px dashed rgba(52,211,153,0.7)" : "1.5px solid rgba(168,85,247,0.8)",
              background: zoneRect ? "rgba(52,211,153,0.06)" : "rgba(168,85,247,0.08)",
            }}
          />
        )}
      </div>

      <Minimap canvasId={canvasId} tasks={shown} clusters={clusters} />

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-[#1a1d24]/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-400 pointer-events-none">
        {Math.round(zoom * 100)}%
      </div>

      {/* Shortcut hint */}
      <div className="absolute bottom-4 left-4 bg-[#1a1d24]/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[10px] text-gray-500 pointer-events-none">
        {zoneDraw ? t("c.canvas.zoneHint") : t("c.canvas.shortcutHint")}
      </div>
    </div>
  );
}

function normalizeRect(r: Rect): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.min(r.x1, r.x2),
    y: Math.min(r.y1, r.y2),
    w: Math.abs(r.x2 - r.x1),
    h: Math.abs(r.y2 - r.y1),
  };
}
