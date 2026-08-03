import { useCallback, useEffect, useRef, useState } from "react";
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
import { CanvasRouterLayout } from "./CanvasRouterLayout";
import { readSpatialCommandCenterShellFlag } from "./spatialCommandCenterFlag";
import { WorkstreamsPanel } from "./WorkstreamsPanel";
import { DensitySelector } from "./DensitySelector";
import { InspectorRail } from "./InspectorRail";
import { TaskInspector } from "./Inspector";
import { InboxTriage, type InboxTriageState } from "./InboxTriage";
import { TodayFocus } from "./TodayFocus";
import { ReviewRail } from "./ReviewRail";
import { TaskRetrieval } from "./TaskRetrieval";
import { OperationsView } from "./OperationsView";
import { LedgerView } from "./LedgerView";
import { resolveSelectionContext } from "./selectionContext";
import { quickParseTokens } from "../utils/quickParse";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useCanvasDataLoader } from "../hooks/useCanvasDataLoader";
import { MobileCommandCenter } from "./MobileCommandCenter";
import { MobileCapture } from "./MobileCapture";
import { MobileInboxTriage } from "./MobileInboxTriage";
import { CommandCenterTutorial, CommandCenterTutorialOffer } from "./CommandCenterTutorial";
import { CommandCenterState } from "./CommandCenterState";
import {
  isMobileCommandCenterEnabled,
  MOBILE_COMMAND_CENTER_QUERY,
  resolveMobileCommandDestination,
  type MobileCommandDestination,
} from "./mobileCommandCenter";

type ModalState =
  | { mode: "create"; x?: number; y?: number }
  | { mode: "edit"; task: Task };

type MobileInspectorReturnDestination = "inbox" | "today" | "review" | "operations" | "more";

export function resolveRailLabel({
  reviewRailOpen,
  todayFocusOpen,
  inboxTriageOpen,
}: {
  reviewRailOpen: boolean;
  todayFocusOpen: boolean;
  inboxTriageOpen: boolean;
}): string {
  if (reviewRailOpen) return tr("review.title");
  if (todayFocusOpen) return tr("today.label");
  if (inboxTriageOpen) return tr("inbox.triage.label");
  return tr("workstreams.title");
}

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
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialReplay, setTutorialReplay] = useState(false);
  const [tutorialOfferRevision, setTutorialOfferRevision] = useState(0);
  const [spatialCommandCenterShell] = useState(readSpatialCommandCenterShellFlag);
  const narrowViewport = useMediaQuery(MOBILE_COMMAND_CENTER_QUERY, false);
  const mobileCommandCenterEligible = isMobileCommandCenterEnabled({
    commandCenterEnabled: spatialCommandCenterShell,
    viewport: narrowViewport ? "narrow" : "wide",
  });
  const [mobileCommandCenterOpen, setMobileCommandCenterOpen] = useState(true);
  const [mobileDestination, setMobileDestination] = useState<MobileCommandDestination>("capture");
  const [mobileInspectorTask, setMobileInspectorTask] = useState<Task | null>(null);
  const [mobileInspectorReturnDestination, setMobileInspectorReturnDestination] = useState<MobileInspectorReturnDestination>("inbox");
  const mobileCommandCenter = mobileCommandCenterEligible && mobileCommandCenterOpen;
  const viewMode = useStore((s) => s.viewMode);
  const helpOpen = useStore((s) => s.helpOpen);
  const workstreams = useStore((s) => s.workstreams);
  const tasks = useStore((s) => s.tasks);
  const dependencies = useStore((s) => s.dependencies);
  const selectedIds = useStore((s) => s.selectedIds);
  const focus = useStore((s) => s.focus);
  const semanticDensity = useStore((s) => s.semanticDensity);
  const readOnly = useStore((s) => s.readOnly);
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState<string | null>(null);
  const [inboxTriageOpen, setInboxTriageOpen] = useState(false);
  const [todayFocusOpen, setTodayFocusOpen] = useState(false);
  const [reviewRailOpen, setReviewRailOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [inboxTriageFocusNonce, setInboxTriageFocusNonce] = useState(0);
  const [inboxTriageState, setInboxTriageState] = useState<InboxTriageState>("loading");
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const mainRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mobileInspectorTriggerRef = useRef<HTMLElement | null>(null);
  const mobileInspectorTaskIdRef = useRef<string | null>(null);
  const mobileRestoreInspectorFocusRef = useRef(false);

  const openMobileInspector = (task: Task, returnDestination: MobileInspectorReturnDestination) => {
    mobileInspectorTriggerRef.current = typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    mobileInspectorTaskIdRef.current = task.id;
    setMobileInspectorReturnDestination(returnDestination);
    setMobileInspectorTask(task);
    setMobileDestination("inspector");
  };

  const returnFromMobileInspector = () => {
    mobileRestoreInspectorFocusRef.current = true;
    setMobileInspectorTask(null);
    setMobileDestination(mobileInspectorReturnDestination);
  };

  useEffect(() => {
    if (mobileRestoreInspectorFocusRef.current && mobileDestination !== "inspector") {
      mobileRestoreInspectorFocusRef.current = false;
      const trigger = mobileInspectorTriggerRef.current;
      if (trigger?.isConnected) {
        trigger.focus();
      } else {
        [...document.querySelectorAll<HTMLButtonElement>("button[data-mobile-inspector-task]")]
          .find((button) => button.dataset.mobileInspectorTask === mobileInspectorTaskIdRef.current)
          ?.focus();
      }
    }
  }, [mobileDestination]);

  const canvasId = params.id ?? null;
  const canvasIdRef = useRef(canvasId);
  canvasIdRef.current = canvasId;

  useLiveSync(canvasId);
  useCanvasDataLoader(canvasId, readOnly, setInboxTriageState);

  // Digest + wake notifications (60s cadence, per-day deduped).
  useEffect(() => startNotificationLoop(() => canvasIdRef.current), []);

  const loadCanvases = useCallback(() => {
    setLoading(true);
    setError(null);
    return useStore
      .getState()
      .loadCanvases()
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);
  const refreshTutorialOffer = useCallback(() => {
    setTutorialOfferRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    void loadCanvases();
  }, [loadCanvases]);

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

  useEffect(() => setSelectedWorkstreamId(null), [canvasId]);

  // Keyboard: Ctrl+K palette · Ctrl+Z/Y undo/redo · N/F/R · V review rail · T/G/H lenses · Esc.
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
        } else if (mobileCommandCenter && mobileDestination === "inspector") {
          returnFromMobileInspector();
        } else if (store.review) {
          exitReview();
        } else if (store.focus) {
          store.exitFocus();
        } else if (store.zoneDraw) {
          store.setZoneDraw(false);
        } else if (mobileCommandCenter) {
          setMobileCommandCenterOpen(false);
        } else if (spatialCommandCenterShell && inboxTriageOpen) {
          setInboxTriageOpen(false);
        } else if (spatialCommandCenterShell && todayFocusOpen) {
          setTodayFocusOpen(false);
        } else if (spatialCommandCenterShell && reviewRailOpen) {
          setReviewRailOpen(false);
        } else if (spatialCommandCenterShell && (store.selectedIds.length || selectedWorkstreamId)) {
          store.clearSelection();
          setSelectedWorkstreamId(null);
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
          if (spatialCommandCenterShell) {
            setTodayFocusOpen(false);
            setReviewRailOpen(false);
            setInboxTriageOpen(true);
            setInboxTriageFocusNonce((nonce) => nonce + 1);
          } else {
            store.setInboxOpen(!store.inboxOpen);
          }
          break;
        case "o":
          if (spatialCommandCenterShell) {
            e.preventDefault();
            if (!todayFocusOpen) setInboxTriageOpen(false);
            if (!todayFocusOpen) setReviewRailOpen(false);
            setTodayFocusOpen(!todayFocusOpen);
          }
          break;
        case "v":
          if (spatialCommandCenterShell) {
            e.preventDefault();
            if (!reviewRailOpen) {
              setTodayFocusOpen(false);
              setInboxTriageOpen(false);
            }
            setReviewRailOpen(!reviewRailOpen);
          }
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
  }, [canvasId, inboxTriageOpen, mobileCommandCenter, mobileDestination, reviewRailOpen, selectedWorkstreamId, spatialCommandCenterShell, todayFocusOpen]);

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

  if (loading) {
    if (spatialCommandCenterShell) return <CommandCenterState kind="loading" title={tr("a.router.loading")} detail={tr("d.state.loadingDetail")} />;
    return <div className="p-8 text-gray-400">{tr("a.router.loading")}</div>;
  }

  if (error) {
    if (spatialCommandCenterShell) return <CommandCenterState kind="error" title={tr("a.router.apiError")} detail={tr("d.state.errorDetail")} action={<button type="button" onClick={() => void loadCanvases()}>{tr("d.state.retry")}</button>} />;
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-2 text-gray-400">
        <div className="text-red-400">{tr("a.router.apiError")}</div>
        <div className="text-xs">{error}</div>
      </div>
    );
  }

  const navigation = (
    <>
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
      {spatialCommandCenterShell && canvasId && (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              if (!todayFocusOpen) setInboxTriageOpen(false);
              if (!todayFocusOpen) setReviewRailOpen(false);
              setTodayFocusOpen(!todayFocusOpen);
            }}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
              todayFocusOpen
                ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 text-gray-300 hover:border-white/25 hover:bg-white/5"
            }`}
          >
            <span>{tr("today.title")}</span>
            <span className="text-cyan-300">O</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTodayFocusOpen(false);
              setReviewRailOpen(false);
              setInboxTriageOpen(true);
              setInboxTriageFocusNonce((nonce) => nonce + 1);
            }}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 ${
              inboxTriageOpen
                ? "border-purple-400/50 bg-purple-400/10 text-purple-100"
                : "border-white/10 text-gray-300 hover:border-white/25 hover:bg-white/5"
            }`}
          >
            <span>{tr("inbox.triage.title")}</span>
            <span className="text-purple-300">{tasks.filter((task) => task.inbox && !task.archivedAt).length}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!reviewRailOpen) {
                setTodayFocusOpen(false);
                setInboxTriageOpen(false);
              }
              setReviewRailOpen(!reviewRailOpen);
            }}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
              reviewRailOpen
                ? "border-amber-400/50 bg-amber-400/10 text-amber-100"
                : "border-white/10 text-gray-300 hover:border-white/25 hover:bg-white/5"
            }`}
          >
            <span>{tr("review.title")}</span>
            <span className="text-amber-300">V</span>
          </button>
          <button
            type="button"
            aria-pressed={ledgerOpen}
            onClick={() => {
              setTodayFocusOpen(false);
              setInboxTriageOpen(false);
              setReviewRailOpen(false);
              setLedgerOpen(!ledgerOpen);
            }}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${ledgerOpen ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100" : "border-white/10 text-gray-300 hover:border-white/25 hover:bg-white/5"}`}
          >
            <span>Ledger</span><span className="text-cyan-300">≡</span>
          </button>
        </div>
      )}
    </>
  );
  const commands = canvasId ? (
    <Toolbar
      canvasId={canvasId}
      onAddTask={() => setModal({ mode: "create" })}
      onOpenTimelapse={() => setTimelapse(true)}
      onOpenPulse={() => setPulseOpen(true)}
    />
  ) : null;
  const selectionContext = resolveSelectionContext({
    selectedIds,
    tasks,
    selectedWorkstreamId,
    workstreams,
    focusActive: Boolean(focus),
  });
  const returnToWorkstreams = () => {
    useStore.getState().clearSelection();
    setSelectedWorkstreamId(null);
  };
  // Desktop-only, read-only entry in the contextual rail. Mobile keeps its existing route.
  const desktopOperationsEntry = spatialCommandCenterShell && !narrowViewport && canvasId ? (
    <section data-operations-view="desktop-contextual-rail">
      <OperationsView
        tasks={tasks}
        workstreams={workstreams}
        dependencies={dependencies}
        onOpenInspector={(task) => {
          setSelectedWorkstreamId(null);
          useStore.getState().setSelected([task.id]);
        }}
        onReveal={(task) => {
          const store = useStore.getState();
          store.setSelected([task.id]);
          store.flashTask(task.id);
          store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
        }}
      />
    </section>
  ) : null;
  const rail = spatialCommandCenterShell && canvasId ? (
    ledgerOpen ? (
      <LedgerView canvasId={canvasId} tasks={tasks} onOpenInspector={(task) => {
        setLedgerOpen(false);
        useStore.getState().setSelected([task.id]);
      }} />
    ) : reviewRailOpen ? (
      <ReviewRail
        tasks={tasks}
        dependencies={dependencies}
        state={inboxTriageState}
        onComplete={(task) => useStore.getState().patchTask(task.id, { done: true })}
        onOpenInspector={(task) => {
          setReviewRailOpen(false);
          useStore.getState().setSelected([task.id]);
        }}
        onReveal={(task) => {
          const store = useStore.getState();
          store.setSelected([task.id]);
          store.flashTask(task.id);
          store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
          setReviewRailOpen(false);
        }}
        onFocus={(task) => {
          setReviewRailOpen(false);
          useStore.getState().startFocus([task.id]);
        }}
        onOpenToday={() => {
          setReviewRailOpen(false);
          setTodayFocusOpen(true);
        }}
        onOpenInbox={() => {
          setReviewRailOpen(false);
          setInboxTriageOpen(true);
          setInboxTriageFocusNonce((nonce) => nonce + 1);
        }}
      />
    ) : todayFocusOpen ? (
      <TodayFocus
        tasks={tasks}
        dependencies={dependencies}
        state={inboxTriageState}
        focusEnabled
        blockerStatusEnabled={spatialCommandCenterShell && !narrowViewport}
        onComplete={(task) => useStore.getState().patchTask(task.id, { done: true })}
        onReturnToInbox={(task) => useStore.getState().patchTask(task.id, { inbox: true })}
        onOpenInspector={(task) => {
          setInboxTriageOpen(false);
          setTodayFocusOpen(false);
          setReviewRailOpen(false);
          useStore.getState().setSelected([task.id]);
        }}
        onReveal={(task) => {
          const store = useStore.getState();
          store.setSelected([task.id]);
          store.flashTask(task.id);
          store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
          setTodayFocusOpen(false);
        }}
        onFocus={(task) => useStore.getState().startFocus([task.id])}
      />
    ) : inboxTriageOpen ? (
      <InboxTriage
        tasks={tasks}
        workstreams={workstreams}
        state={inboxTriageState}
        focusNonce={inboxTriageFocusNonce}
        onCapture={async (input) => {
          const { fields } = quickParseTokens(input);
          if (!fields.title) return;
          await useStore.getState().addTask({
            canvasId,
            title: fields.title,
            tags: fields.tags,
            priority: fields.priority ?? undefined,
            dueDate: fields.dueDate,
            estimateMinutes: fields.estimateMinutes,
            inbox: true,
          });
        }}
        onClearInbox={(task) => useStore.getState().patchTask(task.id, { inbox: false })}
        onSetWorkstream={async (taskId, workstreamId) => {
          const workstream = useStore.getState().workstreams.find((candidate) => candidate.id === workstreamId);
          if (!workstream?.memberships.some((membership) => membership.taskId === taskId)) {
            await useStore.getState().setWorkstreamMembership(workstreamId, taskId, true);
          }
        }}
        onPatchTask={(taskId, patch) => useStore.getState().patchTask(taskId, patch)}
        onReveal={(task) => {
          const store = useStore.getState();
          store.setSelected([task.id]);
          store.flashTask(task.id);
          store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
          setInboxTriageOpen(false);
        }}
      />
    ) : <InspectorRail
      context={selectionContext}
      tasks={tasks}
      workstreams={workstreams}
      dependencies={dependencies}
      onBack={returnToWorkstreams}
      blockerEditor={spatialCommandCenterShell && !narrowViewport ? {
        enabled: true,
        onSetBlocker: (taskId, blockerId) => useStore.getState().setTaskBlocker(taskId, blockerId),
      } : undefined}
      onOpenTask={(task) => {
        setSelectedWorkstreamId(null);
        useStore.getState().setSelected([task.id]);
      }}
      onOpenToday={() => setTodayFocusOpen(true)}
      onOpenReview={() => setReviewRailOpen(true)}
      directory={<>
      {desktopOperationsEntry}
      <TaskRetrieval
        tasks={tasks}
        onOpenInspector={(task) => {
          setSelectedWorkstreamId(null);
          useStore.getState().setSelected([task.id]);
        }}
        onReveal={(task) => {
          const store = useStore.getState();
          store.setSelected([task.id]);
          store.flashTask(task.id);
          store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
        }}
      />
      <DensitySelector density={semanticDensity} onChange={useStore.getState().setSemanticDensity} />
      <WorkstreamsPanel
      workstreams={workstreams}
      selectedId={focus ? null : selectedWorkstreamId}
      onSelect={(id) => {
        useStore.getState().clearSelection();
        setSelectedWorkstreamId(id);
      }}
      onCreate={(name) => {
        void useStore.getState().addWorkstream({ canvasId, name })
          .then((workstream) => setSelectedWorkstreamId(workstream.id))
          .catch((err) => console.error(err));
      }}
      onUpdate={(id, patch) => {
        void useStore.getState().patchWorkstream(id, patch).catch((err) => console.error(err));
      }}
      onDelete={(id) => {
        void useStore.getState().removeWorkstream(id)
          .then(() => setSelectedWorkstreamId((selected) => (selected === id ? null : selected)))
          .catch((err) => console.error(err));
      }}
      tasks={tasks}
      dependencies={dependencies}
      onSetMembership={(workstreamId, taskId, member) => {
        void useStore.getState().setWorkstreamMembership(workstreamId, taskId, member).catch((err) => console.error(err));
      }}
        onApplyArrangement={(preview) => useStore.getState().applyArrangementPreview(preview)}
      />
      </>}
    />
  ) : undefined;
  const mainContent = canvasId ? (
    <>
      <Canvas
        ref={canvasRef}
        canvasId={canvasId}
        semanticDensity={spatialCommandCenterShell ? semanticDensity : "normal"}
        onCreateAt={(x, y) => setModal({ mode: "create", x, y })}
        onEditTask={(task) => setModal({ mode: "edit", task })}
      />
      {!spatialCommandCenterShell && <InboxDock canvasId={canvasId} viewportRef={mainRef} />}
      <SelectionBar canvasId={canvasId} tidyEnabled={spatialCommandCenterShell} />
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
    spatialCommandCenterShell
      ? <CommandCenterState kind="empty" title={tr("a.router.noCanvases")} detail={tr("d.state.emptyDetail")} />
      : <div className="flex items-center justify-center h-full text-gray-500">{tr("a.router.noCanvases")}</div>
  );
  const overlays = (
    <>
      <CommandPalette canvasId={canvasId} onNewTask={() => setModal({ mode: "create" })} fallbackFocusRef={canvasRef} />
      {helpOpen && (
        <HelpPanel
          spatialCommandCenterShell={spatialCommandCenterShell}
          onClose={() => useStore.getState().setHelpOpen(false)}
          onStartTutorial={() => {
            useStore.getState().setHelpOpen(false);
            setTutorialReplay(true);
            setTutorialOpen(true);
          }}
        />
      )}
      {spatialCommandCenterShell && <CommandCenterTutorialOffer key={tutorialOfferRevision} onStart={() => {
        setTutorialReplay(false);
        setTutorialOpen(true);
      }} />}
      {spatialCommandCenterShell && <CommandCenterTutorial open={tutorialOpen} replay={tutorialReplay} onClose={() => {
        setTutorialOpen(false);
        setTutorialReplay(false);
      }} onStatusChange={refreshTutorialOffer} />}
      <Toast />
    </>
  );

  const mobileContent = (() => {
    if (!canvasId) return <CommandCenterState kind="empty" title={tr("a.router.noCanvases")} detail={tr("d.state.emptyDetail")} />;

    if (mobileDestination === "capture") {
      return (
        <MobileCapture
          onCapture={async (input) => {
            const { fields } = quickParseTokens(input);
            if (!fields.title) return;
            await useStore.getState().addTask({
              canvasId,
              title: fields.title,
              tags: fields.tags,
              priority: fields.priority ?? undefined,
              dueDate: fields.dueDate,
              estimateMinutes: fields.estimateMinutes,
              inbox: true,
            });
          }}
        />
      );
    }

    if (mobileDestination === "inbox") {
      return (
        <MobileInboxTriage
          tasks={tasks}
          workstreams={workstreams}
          state={inboxTriageState}
          onClearInbox={(task) => useStore.getState().patchTask(task.id, { inbox: false })}
          onSetWorkstream={async (taskId, workstreamId) => {
            const workstream = useStore.getState().workstreams.find((candidate) => candidate.id === workstreamId);
            if (!workstream?.memberships.some((membership) => membership.taskId === taskId)) {
              await useStore.getState().setWorkstreamMembership(workstreamId, taskId, true);
            }
          }}
          onPatchTask={(taskId, patch) => useStore.getState().patchTask(taskId, patch)}
          onOpenInspector={(task) => openMobileInspector(task, "inbox")}
        />
      );
    }

    if (mobileDestination === "today") {
      return (
        <TodayFocus
          tasks={tasks}
          dependencies={dependencies}
          state={inboxTriageState}
          focusEnabled
          onComplete={(task) => useStore.getState().patchTask(task.id, { done: true })}
          onReturnToInbox={(task) => useStore.getState().patchTask(task.id, { inbox: true })}
          onOpenInspector={(task) => openMobileInspector(task, "today")}
          onReveal={(task) => {
            const store = useStore.getState();
            store.setSelected([task.id]);
            store.flashTask(task.id);
            store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
            setMobileCommandCenterOpen(false);
          }}
          onFocus={(task) => {
            useStore.getState().startFocus([task.id]);
            setMobileCommandCenterOpen(false);
          }}
        />
      );
    }

    if (mobileDestination === "review") {
      return (
        <ReviewRail
          tasks={tasks}
          dependencies={dependencies}
          state={inboxTriageState}
          onComplete={(task) => useStore.getState().patchTask(task.id, { done: true })}
          onOpenInspector={(task) => openMobileInspector(task, "review")}
          onReveal={(task) => {
            const store = useStore.getState();
            store.setSelected([task.id]);
            store.flashTask(task.id);
            store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
            setMobileCommandCenterOpen(false);
          }}
          onFocus={(task) => {
            useStore.getState().startFocus([task.id]);
            setMobileCommandCenterOpen(false);
          }}
          onOpenToday={() => setMobileDestination("today")}
          onOpenInbox={() => setMobileDestination("inbox")}
        />
      );
    }

    if (mobileDestination === "operations") {
      return (
        <OperationsView
          tasks={tasks}
          workstreams={workstreams}
          dependencies={dependencies}
          onOpenInspector={(task) => openMobileInspector(task, "operations")}
          onReveal={(task) => {
            const store = useStore.getState();
            store.setSelected([task.id]);
            store.flashTask(task.id);
            store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
            setMobileCommandCenterOpen(false);
          }}
        />
      );
    }

    if (mobileDestination === "more") {
      return (
        <TaskRetrieval
          tasks={tasks}
          onOpenInspector={(task) => openMobileInspector(task, "more")}
          onReveal={(task) => {
            const store = useStore.getState();
            store.setSelected([task.id]);
            store.flashTask(task.id);
            store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
            setMobileCommandCenterOpen(false);
          }}
        />
      );
    }

    if (mobileDestination === "inspector") {
      return mobileInspectorTask ? (
        <TaskInspector
          task={mobileInspectorTask}
          tasks={tasks}
          workstreams={workstreams}
          dependencies={dependencies}
          onBack={returnFromMobileInspector}
          backLabel={tr(`mobile.command.returnTo${mobileInspectorReturnDestination[0].toUpperCase()}${mobileInspectorReturnDestination.slice(1)}`)}
        />
      ) : <p>{tr("mobile.command.selectInboxTask")}</p>;
    }

    return <p>{tr("mobile.command.unavailable")}</p>;
  })();

  if (mobileCommandCenter) {
    return (
      <>
      <MobileCommandCenter
        destination={resolveMobileCommandDestination(mobileDestination)}
        onDestinationChange={(destination) => {
          setMobileInspectorTask(null);
          setMobileDestination(destination);
        }}
        onClose={() => setMobileCommandCenterOpen(false)}
      >
        {mobileContent}
      </MobileCommandCenter>
      {overlays}
      </>
    );
  }

  return (
    <>
      <CanvasRouterLayout
        spatialCommandCenterShell={spatialCommandCenterShell}
        navigationLabel={tr("d.shell.navigation")}
        commandLabel={tr("d.shell.globalCommands")}
        railLabel={resolveRailLabel({ reviewRailOpen, todayFocusOpen, inboxTriageOpen })}
        navigation={navigation}
        commands={commands}
        rail={rail}
        mainRef={mainRef}
        overlays={overlays}
      >
        {mainContent}
      </CanvasRouterLayout>
      {mobileCommandCenterEligible && (
        <button type="button" className="mobile-command-center-launcher" onClick={() => setMobileCommandCenterOpen(true)}>
          {tr("mobile.command.label")}
        </button>
      )}
    </>
  );
}
