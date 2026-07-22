import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore, visibleTasks, CARD_W, CARD_H, type Task, type CanvasSettings } from "../store";
import { nearestInDirection, nearestToPoint, type Direction } from "../utils/spatialNav";
import { CanvasList } from "./CanvasList";
import { Canvas } from "./Canvas";
import { Toolbar } from "./Toolbar";
import { Toast } from "./Toast";
import { CommandPalette } from "./CommandPalette";
import { InboxDock } from "./InboxDock";
import { DayDock } from "./DayDock";
import { SelectionBar } from "./SelectionBar";
import { TableView } from "./TableView";
import { PulsePanel } from "./PulsePanel";
import { FocusTimer } from "./FocusTimer";
import { ReviewHud, startReview, reviewAct, exitReview } from "./ReviewMode";
import { TimelapseBar } from "./TimelapseBar";
import { CreateModal, type TaskFormData } from "./CreateModal";
import { useLiveSync } from "../data/live";
import { startNotificationLoop } from "../utils/notifications";
import { HelpPanel } from "./HelpPanel";
import { t as tr, useT } from "../i18n";

type ModalState =
  | { mode: "create"; x?: number; y?: number }
  | { mode: "edit"; task: Task };

export function CanvasRouter() {
  useT();
  const params = useParams();
  const navigate = useNavigate();
  const canvases = useStore((s) => s.canvases);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [timelapse, setTimelapse] = useState(false);
  const [pulseOpen, setPulseOpen] = useState(false);
  const viewMode = useStore((s) => s.viewMode);
  const helpOpen = useStore((s) => s.helpOpen);
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const mainRef = useRef<HTMLElement>(null);

  const canvasId = params.id ?? null;
  const canvasIdRef = useRef(canvasId);
  canvasIdRef.current = canvasId;

  useLiveSync(canvasId);

  // Digest + wake notifications (60s cadence, per-day deduped).
  useEffect(() => startNotificationLoop(() => canvasIdRef.current), []);

  useEffect(() => {
    useStore
      .getState()
      .loadCanvases()
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  // Redirect to the first canvas only when the URL doesn't name one.
  useEffect(() => {
    if (!loading && !canvasId && canvases.length > 0) {
      navigate(`/canvas/${canvases[0].id}`, { replace: true });
    }
  }, [loading, canvasId, canvases, navigate]);

  // Restore the per-canvas card density from the canvas settings.
  useEffect(() => {
    if (!canvasId) return;
    const canvas = useStore.getState().canvases.find((c) => c.id === canvasId);
    const density = (canvas?.settings as CanvasSettings | undefined)?.cardDensity;
    useStore.getState().setCardDensity(density === "mini" ? "mini" : "full");
  }, [canvasId, canvases]);

  // Keyboard: Ctrl+K palette · Ctrl+Z/Y undo/redo · N/F/R · T/G/H lenses · Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const store = useStore.getState();

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        store.setPaletteOpen(!store.paletteOpen);
        return;
      }

      if (e.key === "?") {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          store.setHelpOpen(!store.helpOpen);
        }
        return;
      }

      if (e.key === "Escape") {
        if (store.helpOpen) {
          store.setHelpOpen(false);
        } else if (store.paletteOpen) {
          store.setPaletteOpen(false);
        } else if (modalRef.current) {
          setModal(null);
        } else if (store.review) {
          exitReview();
        } else if (store.focus) {
          store.exitFocus();
        } else if (store.zoneDraw) {
          store.setZoneDraw(false);
        } else if (store.selectedIds.length) {
          store.clearSelection();
        } else if (store.dayFilter) {
          store.setDayFilter(null);
        } else if (store.lens !== "off") {
          store.setLens("off");
        }
        return;
      }

      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void (e.shiftKey ? store.redo() : store.undo());
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        void store.redo();
        return;
      }

      if (!canvasId || e.ctrlKey || e.metaKey || e.altKey || modalRef.current) return;

      // Review-flight keys: D done, A archive, S +1 week, P priority, → skip.
      if (store.review) {
        switch (e.key.toLowerCase()) {
          case "d":
            reviewAct("done");
            return;
          case "a":
            reviewAct("archive");
            return;
          case "s":
            reviewAct("push");
            return;
          case "p":
            reviewAct("priority");
            return;
          case "arrowright":
            reviewAct("skip");
            return;
        }
        return; // swallow other keys during review
      }

      // Waypoints: Shift+1..9 saves the framing, 1..9 flies there.
      // (e.code, not e.key — Shift+digit produces symbols on many layouts.)
      if (/^Digit[1-9]$/.test(e.code) && canvasId) {
        const slot = Number(e.code.slice(5));
        e.preventDefault();
        if (e.shiftKey) void store.saveWaypoint(canvasId, slot).catch((err) => console.error(err));
        else store.gotoWaypoint(canvasId, slot);
        return;
      }

      // Spatial navigation: arrows hop to the geometrically nearest card.
      const ARROWS: Record<string, Direction> = {
        arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right",
      };
      const arrowDir = ARROWS[e.key.toLowerCase()];
      if (arrowDir && !store.review && !store.focus && !modalRef.current) {
        e.preventDefault();
        const candidates = visibleTasks(store.tasks, store.showDone, store.showArchived);
        if (candidates.length === 0) return;
        const current = candidates.find(
          (t) => t.id === store.selectedIds[store.selectedIds.length - 1],
        );
        const target = current
          ? nearestInDirection(current, candidates, arrowDir)
          : nearestToPoint(
              candidates,
              (store.viewportW / 2 - store.panX) / store.zoom,
              (store.viewportH / 2 - store.panY) / store.zoom,
            );
        if (!target) return;
        store.setSelected([target.id]);
        store.flashTask(target.id);
        const sx = target.x * store.zoom + store.panX;
        const sy = target.y * store.zoom + store.panY;
        if (
          sx < 0 || sy < 0 ||
          sx + CARD_W * store.zoom > store.viewportW ||
          sy + CARD_H * store.zoom > store.viewportH
        ) {
          store.flyTo(target.x + CARD_W / 2, target.y + CARD_H / 2, store.zoom);
        }
        return;
      }

      // Enter edits / Space toggles done on the current selection.
      if (e.key === "Enter" && store.selectedIds.length === 1 && !modalRef.current) {
        const task = store.tasks.find((t) => t.id === store.selectedIds[0]);
        if (task) {
          e.preventDefault();
          setModal({ mode: "edit", task });
        }
        return;
      }
      if (e.key === " " && store.selectedIds.length > 0 && !modalRef.current) {
        e.preventDefault();
        const targets = store.tasks.filter((t) => store.selectedIds.includes(t.id));
        const allDone = targets.every((t) => t.done);
        void store
          .bulkPatch(
            store.selectedIds,
            { done: !allDone },
            allDone
              ? tr("a.router.reopened", { count: targets.length })
              : tr("a.router.completed", { count: targets.length }),
          )
          .catch((err) => console.error(err));
        return;
      }

      // Focus-mode session keys: J/K cycle, D done, E edit.
      if (store.focus) {
        const currentId = store.focus.members[store.focus.index];
        const current = store.tasks.find((t) => t.id === currentId);
        switch (e.key.toLowerCase()) {
          case "j":
            store.stepFocus(1);
            return;
          case "k":
            store.stepFocus(-1);
            return;
          case "d":
            if (current) {
              void store.patchTask(current.id, { done: !current.done }).catch((err) => console.error(err));
            }
            return;
          case "e":
            if (current) setModal({ mode: "edit", task: current });
            return;
        }
      }

      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          setModal({ mode: "create" });
          break;
        case "f":
          store.fitView();
          break;
        case "r":
          store.setView(1, 0, 0);
          break;
        case "t":
          store.setLens(store.lens === "time" ? "off" : "time");
          break;
        case "g":
          store.setLens(store.lens === "gravity" ? "off" : "gravity");
          break;
        case "h":
          store.setLens(store.lens === "heat" ? "off" : "heat");
          break;
        case "i":
          e.preventDefault();
          store.setInboxOpen(!store.inboxOpen);
          break;
        case "w":
          startReview();
          break;
        case "z":
          store.setZoneDraw(!store.zoneDraw);
          break;
        case "y":
          store.setDayDockOpen(!store.dayDockOpen);
          break;
        case "l":
          store.setViewMode(store.viewMode === "table" ? "canvas" : "table");
          break;
        case "m":
          store.setCardDensity(store.cardDensity === "mini" ? "full" : "mini", canvasIdRef.current ?? undefined);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canvasId]);

  const handleSubmit = async (data: TaskFormData) => {
    if (!modal || !canvasId) return;
    try {
      if (modal.mode === "edit") {
        await useStore.getState().patchTask(modal.task.id, data);
      } else {
        let { x, y } = modal;
        if (x === undefined || y === undefined) {
          // Spawn at the center of the visible viewport, in world coordinates.
          const { zoom, panX, panY, viewportW, viewportH } = useStore.getState();
          const jitter = () => (Math.random() - 0.5) * 80;
          x = (viewportW / 2 - panX) / zoom - 128 + jitter();
          y = (viewportH / 2 - panY) / zoom - 80 + jitter();
        }
        await useStore.getState().addTask({ ...data, canvasId, x, y });
      }
    } catch (e) {
      console.error(e);
      useStore.getState().showToast(tr("a.router.saveFailed"));
    }
  };

  if (loading) return <div className="p-8 text-gray-400">{tr("a.router.loading")}</div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-2 text-gray-400">
        <div className="text-red-400">{tr("a.router.apiError")}</div>
        <div className="text-xs">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f0f13] text-gray-100 font-sans">
      <aside className="w-64 flex-shrink-0 border-r border-white/10 bg-[#1a1d24]/90 backdrop-blur-sm p-4 overflow-y-auto">
        {/* Nimbus wordmark — a glowing halo dot, matching the bubble motif */}
        <div className="flex items-center gap-2 mb-5 px-1">
          <span
            className="w-3.5 h-3.5 rounded-full bubble-pulse shrink-0"
            style={{
              background: "radial-gradient(circle, #67e8f9, #6366f1)",
              boxShadow: "0 0 12px 2px rgba(103,232,249,0.6)",
            }}
          />
          <span className="text-base font-semibold tracking-wide text-gray-100">{tr("app.name")}</span>
        </div>
        <CanvasList canvases={canvases} canvasId={canvasId} />
      </aside>

      <main ref={mainRef} className="flex-1 h-full overflow-hidden relative">
        {canvasId ? (
          <>
            <Toolbar
              canvasId={canvasId}
              onAddTask={() => setModal({ mode: "create" })}
              onOpenTimelapse={() => setTimelapse(true)}
              onOpenPulse={() => setPulseOpen(true)}
            />
            <Canvas
              canvasId={canvasId}
              onCreateAt={(x, y) => setModal({ mode: "create", x, y })}
              onEditTask={(task) => setModal({ mode: "edit", task })}
            />
            <InboxDock canvasId={canvasId} viewportRef={mainRef} />
            <SelectionBar canvasId={canvasId} />
            <DayDock />
            <ReviewHud />
            <FocusTimer />
            {viewMode === "table" && (
              <TableView onExit={() => useStore.getState().setViewMode("canvas")} />
            )}
            {pulseOpen && <PulsePanel canvasId={canvasId} onClose={() => setPulseOpen(false)} />}
            {timelapse && <TimelapseBar canvasId={canvasId} onClose={() => setTimelapse(false)} />}
            {modal && (
              <CreateModal
                key={modal.mode === "edit" ? modal.task.id : "create"}
                initial={modal.mode === "edit" ? modal.task : null}
                variant={modal.mode === "edit" ? "panel" : "modal"}
                onClose={() => setModal(null)}
                onSubmit={handleSubmit}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            {tr("a.router.noCanvases")}
          </div>
        )}
      </main>

      <CommandPalette canvasId={canvasId} onNewTask={() => setModal({ mode: "create" })} />
      {helpOpen && <HelpPanel onClose={() => useStore.getState().setHelpOpen(false)} />}
      <Toast />
    </div>
  );
}
