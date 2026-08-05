import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useStore, visibleTasks, CARD_W, CARD_H, type Task, type CanvasSettings } from "../store";
import { nearestInDirection, nearestToPoint, type Direction } from "../utils/spatialNav";
import { NavigationRail } from "./NavigationRail";
import { Canvas } from "./Canvas";
import { TopBar } from "./TopBar";
import { CanvasToolbar } from "./CanvasToolbar";
import { Toast } from "./Toast";
import { CommandPalette } from "./CommandPalette";

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
import { NightCartographySurface } from "./NightCartography";
import { resolveSelectionContext } from "./selectionContext";
import { canvasDestinationFromPath, canvasPathForDestination, type CanvasDestination } from "./destinationRoutes";
import { DestinationSheet } from "./DestinationSheet";
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
} from "./mobileCommandDestination";

type ModalState =
  | { mode: "create"; x?: number; y?: number }
  | { mode: "capture" }
  | { mode: "edit"; task: Task };

type MobileInspectorReturnDestination = "inbox" | "today" | "review" | "operations" | "ledger" | "more";

export function resolveRailLabel(destination: CanvasDestination): string {
  if (destination === "review") return tr("review.title");
  if (destination === "today") return tr("today.label");
  if (destination === "inbox") return tr("inbox.triage.label");
  if (destination === "operations") return tr("operations.label");
  return tr("workstreams.title");
}

export function CanvasRouter() {
  useT();
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const canvases = useStore((s) => s.canvases);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [timelapse, setTimelapse] = useState(false);
  const [pulseOpen, setPulseOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialReplay, setTutorialReplay] = useState(false);
  const [tutorialOfferRevision, setTutorialOfferRevision] = useState(0);
  const narrowViewport = useMediaQuery(MOBILE_COMMAND_CENTER_QUERY, false);
  const compactDesktop = useMediaQuery("(min-width: 769px) and (max-width: 1100px)", false);
  const mobileCommandCenterEligible = isMobileCommandCenterEnabled(narrowViewport ? "narrow" : "wide");
  const [mobileCommandCenterOpen, setMobileCommandCenterOpen] = useState(true);
  const [mobileDestination, setMobileDestination] = useState<MobileCommandDestination>("today");
  const [mobileCaptureOpen, setMobileCaptureOpen] = useState(false);
  const [mobileCaptureReturnDestination, setMobileCaptureReturnDestination] = useState<MobileCommandDestination>("today");
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
  const [compactRailOpen, setCompactRailOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [inboxTriageFocusNonce, setInboxTriageFocusNonce] = useState(0);
  const [inboxTriageState, setInboxTriageState] = useState<InboxTriageState>("loading");
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const mainRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mobileInspectorTriggerRef = useRef<HTMLElement | null>(null);
  const mobileInspectorTaskIdRef = useRef<string | null>(null);
  const mobileRestoreInspectorFocusRef = useRef(false);
  const mobileCommandCenterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileRestoreCommandCenterFocusRef = useRef(false);

  const closeCommandCenterRail = () => {
    useStore.getState().clearSelection();
    setSelectedWorkstreamId(null);
    setCompactRailOpen(false);
  };

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

  useEffect(() => {
    if (mobileRestoreCommandCenterFocusRef.current && !mobileCommandCenterOpen) {
      mobileRestoreCommandCenterFocusRef.current = false;
      queueMicrotask(() => mobileCommandCenterTriggerRef.current?.focus());
    }
  }, [mobileCommandCenterOpen]);

  const closeMobileCommandCenter = () => {
    mobileRestoreCommandCenterFocusRef.current = true;
    setMobileCaptureOpen(false);
    setMobileDestination(routeDestination);
    setMobileCommandCenterOpen(false);
  };

  const canvasId = params.id ?? null;
  const routeDestination = canvasId ? canvasDestinationFromPath(location.pathname, canvasId) : "canvas";
  const navigateDestination = (destination: "canvas" | "inbox" | "today" | "review" | "operations" | "ledger") => {
    if (!canvasId) return;
    navigate(canvasPathForDestination(canvasId, destination));
  };
  // Canonical canvas routes are also the source of truth for mobile destinations.
  // Transient Capture, Inspector, and More stay local because they have no route.
  useEffect(() => {
    if (!mobileCommandCenterEligible) return;
    setMobileDestination((current) => current === "capture" || current === "inspector" || current === "more" ? current : routeDestination);
  }, [mobileCommandCenterEligible, routeDestination]);
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
          closeMobileCommandCenter();
        } else if (routeDestination !== "canvas") {
          navigateDestination("canvas");
        } else if (store.selectedIds.length || selectedWorkstreamId) {
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
          navigateDestination("inbox");
          setInboxTriageFocusNonce((nonce) => nonce + 1);
          break;
        case "o":
          e.preventDefault();
          navigateDestination(routeDestination === "today" ? "canvas" : "today");
          break;
        case "v":
          e.preventDefault();
          navigateDestination(routeDestination === "review" ? "canvas" : "review");
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
  }, [canvasId, mobileCommandCenter, mobileDestination, routeDestination, selectedWorkstreamId]);

  const handleSubmit = async (data: TaskFormData) => {
    if (!modal || !canvasId) return;
    try {
      if (modal.mode === "edit") {
        await useStore.getState().patchTask(modal.task.id, data);
      } else {
        let { x, y } = modal.mode === "create" ? modal : {};
        if (x === undefined || y === undefined) {
          // Spawn at the center of the visible viewport, in world coordinates.
          const { zoom, panX, panY, viewportW, viewportH } = useStore.getState();
          const jitter = () => (Math.random() - 0.5) * 80;
          x = (viewportW / 2 - panX) / zoom - 128 + jitter();
          y = (viewportH / 2 - panY) / zoom - 80 + jitter();
        }
        // The Command Center's visible Capture action is intentionally
        // different from generic canvas creation: captured work begins in
        // Inbox/Triage, where the user explicitly decides what happens next.
        await useStore.getState().addTask({ ...data, canvasId, x, y, inbox: modal.mode === "capture" });
      }
    } catch (e) {
      console.error(e);
      useStore.getState().showToast(tr("a.router.saveFailed"));
    }
  };

  if (loading) return <CommandCenterState kind="loading" title={tr("a.router.loading")} detail={tr("d.state.loadingDetail")} />;

  if (error) return <CommandCenterState kind="error" title={tr("a.router.apiError")} detail={tr("d.state.errorDetail")} action={<button type="button" onClick={() => void loadCanvases()}>{tr("d.state.retry")}</button>} />;

  const navigation = (
    <NavigationRail
      canvasId={canvasId ?? null}
      destination={routeDestination}
      inboxCount={tasks.filter((task) => task.inbox && !task.archivedAt).length}
      onNavigate={navigateDestination}
      onCapture={() => setModal({ mode: "capture" })}
    />
  );
  const commands = <TopBar canvasId={canvasId ?? null} />;
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
  const inspectTask = (task: Task) => {
    setSelectedWorkstreamId(null);
    useStore.getState().setSelected([task.id]);
    if (compactDesktop) setCompactRailOpen(true);
  };
  const revealTask = (task: Task) => {
    const store = useStore.getState();
    store.setSelected([task.id]);
    store.flashTask(task.id);
    store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
    navigateDestination("canvas");
  };
  // The rail exists when: the inspector has content (always shows), or the
  // directory is wanted — on compact desktop behind the drawer toggle, on wide
  // desktop unless the user collapsed it in favour of the full-width field.
  const railVisible = compactDesktop ? compactRailOpen : !railCollapsed;
  const rail = canvasId && (railVisible || selectionContext.kind !== "directory") ? <InspectorRail
    context={selectionContext}
    tasks={tasks}
    workstreams={workstreams}
    dependencies={dependencies}
    onBack={returnToWorkstreams}
    blockerEditor={{ enabled: true, onSetBlocker: (taskId, blockerId) => useStore.getState().setTaskBlocker(taskId, blockerId) }}
    onOpenTask={inspectTask}
    onOpenToday={() => navigateDestination("today")}
    onOpenReview={() => navigateDestination("review")}
    directory={<section className="command-center-utilities" aria-label={tr("d.utilities.label")}>
      <h2>{tr("d.utilities.label")}</h2>
      <TaskRetrieval tasks={tasks} onOpenInspector={inspectTask} onReveal={revealTask} />
      <DensitySelector density={semanticDensity} onChange={useStore.getState().setSemanticDensity} />
      <WorkstreamsPanel
        workstreams={workstreams}
        selectedId={focus ? null : selectedWorkstreamId}
        onSelect={(id) => { useStore.getState().clearSelection(); setSelectedWorkstreamId(id); }}
        onCreate={(name) => { void useStore.getState().addWorkstream({ canvasId, name }).then((workstream) => setSelectedWorkstreamId(workstream.id)).catch(console.error); }}
        onUpdate={(id, patch) => { void useStore.getState().patchWorkstream(id, patch).catch(console.error); }}
        onDelete={(id) => { void useStore.getState().removeWorkstream(id).then(() => setSelectedWorkstreamId((selected) => selected === id ? null : selected)).catch(console.error); }}
        tasks={tasks}
        dependencies={dependencies}
        onSetMembership={(workstreamId, taskId, member) => { void useStore.getState().setWorkstreamMembership(workstreamId, taskId, member).catch(console.error); }}
        onApplyArrangement={(preview) => useStore.getState().applyArrangementPreview(preview)}
      />
    </section>}
  /> : undefined;
  // Destinations are sheets floating over the always-mounted canvas: the
  // spatial field never unmounts, so pan/zoom/cluster state and canvas chrome
  // stay alive while the user works a queue.
  const destinationSheet = !canvasId || routeDestination === "canvas" ? null
    : routeDestination === "inbox" ? <NightCartographySurface kind="inbox" title={tr("inbox.triage.title")}>
      <InboxTriage tasks={tasks} workstreams={workstreams} state={inboxTriageState} focusNonce={inboxTriageFocusNonce}
        onCapture={async (input) => { const { fields } = quickParseTokens(input); if (fields.title) await useStore.getState().addTask({ canvasId, title: fields.title, tags: fields.tags, priority: fields.priority ?? undefined, dueDate: fields.dueDate, estimateMinutes: fields.estimateMinutes, inbox: true }); }}
        onClearInbox={(task) => useStore.getState().patchTask(task.id, { inbox: false })}
        onSetWorkstream={async (taskId, workstreamId) => { const workstream = useStore.getState().workstreams.find((candidate) => candidate.id === workstreamId); if (!workstream?.memberships.some((membership) => membership.taskId === taskId)) await useStore.getState().setWorkstreamMembership(workstreamId, taskId, true); }}
        onPatchTask={(taskId, patch) => useStore.getState().patchTask(taskId, patch)} onReveal={revealTask} />
    </NightCartographySurface>
    : routeDestination === "today" ? <NightCartographySurface kind="today" title={tr("today.title")}>
      <TodayFocus tasks={tasks} dependencies={dependencies} state={inboxTriageState} focusEnabled blockerStatusEnabled
        onComplete={(task) => useStore.getState().patchTask(task.id, { done: true })} onReturnToInbox={(task) => useStore.getState().patchTask(task.id, { inbox: true })}
        onOpenInspector={inspectTask} onReveal={revealTask} onFocus={(task) => useStore.getState().startFocus([task.id])} />
    </NightCartographySurface>
    : routeDestination === "review" ? <NightCartographySurface kind="review" title={tr("review.title")}>
      <ReviewRail tasks={tasks} dependencies={dependencies} state={inboxTriageState} onComplete={(task) => useStore.getState().patchTask(task.id, { done: true })}
        onOpenInspector={inspectTask} onReveal={revealTask} onFocus={(task) => useStore.getState().startFocus([task.id])}
        onOpenToday={() => navigateDestination("today")} onOpenInbox={() => navigateDestination("inbox")} />
    </NightCartographySurface>
    : routeDestination === "operations" ? <NightCartographySurface kind="operations" title={tr("operations.title")}>
      <OperationsView tasks={tasks} workstreams={workstreams} dependencies={dependencies} onOpenInspector={inspectTask} onReveal={revealTask} />
    </NightCartographySurface>
    : routeDestination === "ledger" ? <NightCartographySurface kind="ledger" title={tr("d.shell.ledger")}>
      <LedgerView canvasId={canvasId} tasks={tasks} onOpenInspector={inspectTask} />
    </NightCartographySurface>
    : null;
  const mainContent = !canvasId ? <CommandCenterState kind="empty" title={tr("a.router.noCanvases")} detail={tr("d.state.emptyDetail")} /> : (
    <>
      <NightCartographySurface kind="canvas" title={tr("d.shell.canvas")}>
        <Canvas ref={canvasRef} canvasId={canvasId} semanticDensity={semanticDensity} onCreateAt={(x, y) => setModal({ mode: "create", x, y })} onEditTask={(task) => setModal({ mode: "edit", task })} />
        {/* Canvas tools float over the field and hide beneath destination sheets. */}
        {routeDestination === "canvas" && (
          <CanvasToolbar canvasId={canvasId} onAddTask={() => setModal({ mode: "create" })} onOpenTimelapse={() => setTimelapse(true)} onOpenPulse={() => setPulseOpen(true)} />
        )}
        <SelectionBar canvasId={canvasId} tidyEnabled /><DayDock /><ReviewHud /><FocusTimer />
        {viewMode === "table" && <TableView onExit={() => useStore.getState().setViewMode("canvas")} />}
        {pulseOpen && <PulsePanel canvasId={canvasId} onClose={() => setPulseOpen(false)} />}
        {timelapse && <TimelapseBar canvasId={canvasId} onClose={() => setTimelapse(false)} />}
      </NightCartographySurface>
      {destinationSheet && (
        <DestinationSheet kind={routeDestination as Exclude<CanvasDestination, "canvas">} closeLabel={tr("d.sheet.close")} onClose={() => navigateDestination("canvas")}>
          {destinationSheet}
        </DestinationSheet>
      )}
      {/* Route-independent: capture/edit must work from every destination. */}
      {modal && <CreateModal key={modal.mode === "edit" ? modal.task.id : modal.mode} initial={modal.mode === "edit" ? modal.task : null} variant={modal.mode === "edit" ? "panel" : "modal"} onClose={() => setModal(null)} onSubmit={handleSubmit} />}
    </>
  );
  const overlays = (
    <>
      <CommandPalette canvasId={canvasId} onNewTask={() => setModal({ mode: "create" })} fallbackFocusRef={canvasRef} />
      {helpOpen && (
        <HelpPanel
          onClose={() => useStore.getState().setHelpOpen(false)}
          onStartTutorial={() => {
            useStore.getState().setHelpOpen(false);
            // The tour spotlights canvas-only chrome (floating toolbar), so it
            // always starts from the canvas route — sheets would hide step 5.
            if (canvasId && routeDestination !== "canvas") navigateDestination("canvas");
            setTutorialReplay(true);
            setTutorialOpen(true);
          }}
        />
      )}
      <CommandCenterTutorialOffer key={tutorialOfferRevision} onStart={() => {
        if (canvasId && routeDestination !== "canvas") navigateDestination("canvas");
        setTutorialReplay(false);
        setTutorialOpen(true);
      }} />
      <CommandCenterTutorial open={tutorialOpen} replay={tutorialReplay} onClose={() => {
        setTutorialOpen(false);
        setTutorialReplay(false);
      }} onStatusChange={refreshTutorialOffer} />
      <Toast />
    </>
  );

  const mobileContent = (() => {
    if (!canvasId) return <CommandCenterState kind="empty" title={tr("a.router.noCanvases")} detail={tr("d.state.emptyDetail")} />;

    if (mobileDestination === "capture") {
      return (
        <MobileCapture
          backLabel={`${tr("mobile.command.back")} ${tr(`mobile.command.${mobileCaptureReturnDestination}`)}`}
          onBack={() => {
            setMobileCaptureOpen(false);
            setMobileDestination(mobileCaptureReturnDestination);
          }}
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

    if (mobileDestination === "canvas") {
      return <Canvas ref={canvasRef} canvasId={canvasId} semanticDensity={semanticDensity} onCreateAt={(x, y) => setModal({ mode: "create", x, y })} onEditTask={(task) => setModal({ mode: "edit", task })} />;
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
            closeMobileCommandCenter();
          }}
          onFocus={(task) => {
            useStore.getState().startFocus([task.id]);
            closeMobileCommandCenter();
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
            closeMobileCommandCenter();
          }}
          onFocus={(task) => {
            useStore.getState().startFocus([task.id]);
            closeMobileCommandCenter();
          }}
          onOpenToday={() => { setMobileDestination("today"); navigateDestination("today"); }}
          onOpenInbox={() => { setMobileDestination("inbox"); navigateDestination("inbox"); }}
        />
      );
    }

    if (mobileDestination === "operations") {
      return (
        <OperationsView
          mobile
          tasks={tasks}
          workstreams={workstreams}
          dependencies={dependencies}
          onOpenInspector={(task) => openMobileInspector(task, "operations")}
          onReveal={(task) => {
            const store = useStore.getState();
            store.setSelected([task.id]);
            store.flashTask(task.id);
            store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
            closeMobileCommandCenter();
          }}
        />
      );
    }

    if (mobileDestination === "ledger") {
      return <LedgerView canvasId={canvasId} tasks={tasks} onOpenInspector={(task) => openMobileInspector(task, "ledger")} />;
    }

    if (mobileDestination === "more") {
      return (
        <section className="mobile-utilities" aria-label={tr("mobile.command.more")}>
          <h2>{tr("mobile.command.more")}</h2>
          <p>{tr("mobile.utilities.description")}</p>
          <div className="mobile-utilities__destinations">
            <button type="button" onClick={() => { setMobileDestination("review"); navigateDestination("review"); }}>{tr("review.title")}</button>
            <button type="button" onClick={() => { setMobileDestination("operations"); navigateDestination("operations"); }}>{tr("operations.label")}</button>
            <button type="button" onClick={() => { setMobileDestination("ledger"); navigateDestination("ledger"); }}>{tr("d.shell.ledger")}</button>
          </div>
          <TaskRetrieval
            mobile
            tasks={tasks}
            onOpenInspector={(task) => openMobileInspector(task, "more")}
            onReveal={(task) => {
              const store = useStore.getState();
              store.setSelected([task.id]);
              store.flashTask(task.id);
              store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, store.zoom);
              closeMobileCommandCenter();
            }}
          />
        </section>
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
          setMobileCaptureOpen(false);
          setMobileDestination(destination);
          if (destination !== "more") navigateDestination(destination);
        }}
        onCapture={() => {
          const returnDestination = mobileDestination === "capture" || mobileDestination === "inspector" ? routeDestination : mobileDestination;
          setMobileCaptureReturnDestination(returnDestination);
          setMobileCaptureOpen(true);
          setMobileDestination("capture");
        }}
        onClose={closeMobileCommandCenter}
      >
        {mobileContent}
        {modal && <CreateModal key={modal.mode === "edit" ? modal.task.id : modal.mode} initial={modal.mode === "edit" ? modal.task : null} variant={modal.mode === "edit" ? "panel" : "modal"} onClose={() => setModal(null)} onSubmit={handleSubmit} />}
      </MobileCommandCenter>
      {overlays}
      </>
    );
  }

  return (
    <>
      <CanvasRouterLayout
        navigationLabel={tr("d.shell.navigation")}
        commandLabel={tr("d.shell.globalCommands")}
        railLabel={selectionContext.kind === "directory" ? tr("d.utilities.label") : tr("inspector.label")}
        railModal={compactDesktop && Boolean(rail)}
        railToggle={selectionContext.kind === "directory" && (compactDesktop || railCollapsed)}
        openRailLabel={tr("d.utilities.label")}
        closeRailLabel={selectionContext.kind === "directory" ? tr("d.shell.closeRail") : tr("d.shell.closeInspector")}
        onCloseRail={
          // Closing means the nearest meaningful thing: inspector → deselect;
          // directory → close the drawer (compact) or collapse the rail (wide).
          selectionContext.kind !== "directory" ? closeCommandCenterRail
            : compactDesktop
              ? (compactRailOpen ? closeCommandCenterRail : () => setCompactRailOpen(true))
              : railCollapsed ? () => setRailCollapsed(false) : () => setRailCollapsed(true)
        }
        navigation={navigation}
        commands={commands}
        rail={rail}
        fullWidth
        mainRef={mainRef}
        overlays={overlays}
      >
        {mainContent}
      </CanvasRouterLayout>
      {mobileCommandCenterEligible && (
        <button ref={mobileCommandCenterTriggerRef} type="button" className="mobile-command-center-launcher" onClick={() => setMobileCommandCenterOpen(true)}>
          {tr("mobile.command.label")}
        </button>
      )}
    </>
  );
}
