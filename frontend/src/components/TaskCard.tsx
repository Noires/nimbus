import { useRef, useState } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { useStore, visibleTasks, CARD_W, CARD_H, DAY_W, type Task } from "../store";
import { cardGradient, urgencyColor, stalenessColor } from "../utils/colors";
import { formatMinutes } from "../utils/capacity";
import { resolveOverlap } from "../engine/collision";
import { dayDockHit } from "./DayDock";
import { useT, dateLocale } from "../i18n";
import { resolveSemanticDensity, type CardDensity } from "../engine/semanticDensity";
import { MenuPanel } from "./toolbarMenu";
import { IconArchive, IconClock, IconHourglass, IconLock, IconPencil, IconRestore, IconTrash } from "./ui/icons";
import { selectZonesContainingTask } from "../data/spatialZoneSelectors";

interface TaskCardProps {
  task: Task;
  dimmed: boolean;
  blocked: boolean;
  focused?: boolean;
  selected?: boolean;
  semanticDensity?: CardDensity;
  onEdit: (task: Task) => void;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dueDays(task: Task): number | null {
  if (!task.dueDate) return null;
  return Math.round(
    (startOfDay(new Date(task.dueDate)).getTime() - startOfDay(new Date()).getTime()) / 86_400_000,
  );
}

export const TIME_GUTTER_X = 380; // undated "someday" gutter offset left of origin

export function projectTimeX(task: Task, originX: number): number {
  const days = dueDays(task);
  return days === null ? originX - TIME_GUTTER_X : originX + days * DAY_W;
}

export function taskCardTransition(reducedMotion: boolean | null, isDragging: boolean): Transition {
  if (reducedMotion) return { duration: 0 };
  return {
    left: isDragging ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 30 },
    top: isDragging ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 30 },
    opacity: { duration: 0.2, ease: "easeOut" },
    scale: { type: "spring", stiffness: 480, damping: 20 },
    y: { type: "spring", stiffness: 480, damping: 22 },
    default: { type: "spring", stiffness: 400, damping: 28 },
  };
}

export function TaskCard({ task, dimmed, blocked, focused, selected, semanticDensity = "normal", onEdit }: TaskCardProps) {
  const t = useT();
  const reducedMotion = useReducedMotion();
  const isDragging = useStore((s) => s.draggingTaskId === task.id);
  const lens = useStore((s) => s.lens);
  const timeOriginX = useStore((s) => s.timeOriginX);
  const flashing = useStore((s) => s.flashTaskId === task.id);
  const readOnly = useStore((s) => s.readOnly);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    taskX: number;
    taskY: number;
    group: Map<string, { x: number; y: number }> | null;
  } | null>(null);
  const [timeDrag, setTimeDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const archived = !!task.archivedAt;
  const days = dueDays(task);
  const overdue = days !== null && days < 0 && !task.done;
  const timeLens = lens === "time" && timeOriginX !== null;

  // External sync: "github:owner/repo#123" → repo badge + status columns.
  const connection = useStore((s) =>
    task.connectionId ? s.connections.find((c) => c.id === task.connectionId) : undefined,
  );
  const externalRef = task.externalKey?.match(/^[^:]+:(?:[^/]+)\/([^#]+)#(\d+)$/);
  const statusColumns = connection?.columnsCache ?? [];
  const legacyMini = useStore((s) => s.cardDensity) === "mini";
  const zoom = useStore((s) => s.zoom);
  const density = resolveSemanticDensity(semanticDensity, zoom);
  const isSemanticDensity = semanticDensity !== "normal";
  const mini = legacyMini && !isSemanticDensity;
  const showDescription = !isSemanticDensity || density.disclose === "full";
  const showTags = !isSemanticDensity || density.disclose === "full";
  const showSummaryMetadata = density.disclose !== "essential";

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || readOnly) return;
    // Clicks on interactive controls (or their children) must not start a drag
    // or bubble to the canvas — pointer capture would steal the ensuing click.
    if ((e.target as HTMLElement).closest("button, input, textarea, select, a, [data-port]")) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const store = useStore.getState();
    // Dragging a selected card moves the whole lasso selection.
    const group =
      store.selectedIds.includes(task.id) && store.selectedIds.length > 1
        ? new Map(
            store.tasks
              .filter((t) => store.selectedIds.includes(t.id))
              .map((t) => [t.id, { x: t.x, y: t.y }]),
          )
        : null;
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      taskX: task.x,
      taskY: task.y,
      group,
    };
    store.setDragging(task.id);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const store = useStore.getState();
    const { zoom, moveTaskLocal, moveTasksLocal } = store;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    if (timeLens) {
      setTimeDrag({ dx, dy });
      return;
    }
    if (d.group) {
      moveTasksLocal(store.selectedIds, (e.clientX - d.lastX) / zoom, (e.clientY - d.lastY) / zoom);
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      return;
    }
    let nx = d.taskX + dx;
    let ny = d.taskY + dy;
    if (e.shiftKey) {
      nx = Math.round(nx / 24) * 24;
      ny = Math.round(ny / 24) * 24;
    }
    moveTaskLocal(task.id, nx, ny);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const store = useStore.getState();

    // Finishing a dependency link that started on another card's port.
    if (store.linking) {
      if (store.linking.fromId !== task.id) {
        store.addDependency(store.linking.fromId, task.id);
      }
      store.setLinking(null);
      e.stopPropagation();
      return;
    }

    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    store.setDragging(null);

    const moved = Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4;
    if (!moved && e.shiftKey && !timeLens) {
      store.toggleSelected(task.id);
      return;
    }
    // A regular release is an explicit Inspector handoff, not merely an
    // opportunity to bump the card's z-index. Keep this ahead of group-move
    // handling so clicking one member of a multi-selection makes it active.
    if (!moved && !timeLens) {
      store.setSelected([task.id]);
      return;
    }

    // Group move: commit the whole selection as one batch-undo step.
    if (d.group) {
      store.commitClusterMove(store.selectedIds, d.group).catch((err) => console.error(err));
      return;
    }

    if (timeLens) {
      // Horizontal position = due date; dropping into the gutter clears it.
      const drop = timeDrag;
      setTimeDrag(null);
      if (!drop || (Math.abs(drop.dx) < 4 && Math.abs(drop.dy) < 4)) return;
      const projX = projectTimeX(task, timeOriginX!) + drop.dx;
      let dueDate: string | null = null;
      if (projX >= timeOriginX! - TIME_GUTTER_X / 2) {
        const daysOut = Math.round((projX - timeOriginX!) / DAY_W);
        dueDate = new Date(startOfDay(new Date()).getTime() + daysOut * 86_400_000).toISOString();
      }
      store
        .patchTask(task.id, { dueDate, y: task.y + drop.dy })
        .catch((err) => console.error(err));
      return;
    }

    const current = store.tasks.find((t) => t.id === task.id);
    if (!current) return;

    // Day-dock drop: throwing a card at a day schedules it (card springs home).
    const dock = dayDockHit.current;
    if (
      dock &&
      e.clientY >= dock.rect.top && e.clientY <= dock.rect.bottom &&
      e.clientX >= dock.rect.left && e.clientX <= dock.rect.right
    ) {
      const idx = Math.min(
        Math.max(Math.floor(((e.clientX - dock.rect.left) / dock.rect.width) * dock.days.length), 0),
        dock.days.length - 1,
      );
      const due = new Date(`${dock.days[idx]}T00:00:00`);
      store
        .patchTask(task.id, { dueDate: due.toISOString(), x: d.taskX, y: d.taskY })
        .then(() => store.showToast(t("b.card.toast.due", { title: task.title, date: due.toLocaleDateString(dateLocale()) })))
        .catch((err) => console.error(err));
      return;
    }

    // Portal drop: send the card to another canvas.
    const cx = current.x + CARD_W / 2;
    const cy = current.y + CARD_H / 2;
    const portal = store.portals.find((p) => Math.hypot(p.x - cx, p.y - cy) < 100);
    if (portal) {
      store
        .patchTask(task.id, { canvasId: portal.targetCanvasId })
        .then(() => store.showToast(t("b.card.toast.sent", { title: task.title, target: portal.target?.name ?? t("b.card.toast.anotherCanvas") })))
        .catch((err) => console.error(err));
      return;
    }

    // Declutter: never bury another card more than 60%.
    const others = visibleTasks(store.tasks, store.showDone, store.showArchived);
    const nudged = resolveOverlap({ x: current.x, y: current.y }, task.id, others);
    const finalX = nudged?.x ?? current.x;
    const finalY = nudged?.y ?? current.y;
    const topZ = Math.max(0, ...store.tasks.map((t) => t.z)) + 1;

    // Zones: entering applies the zone's auto-tag, leaving removes it.
    const before = selectZonesContainingTask({ x: d.taskX, y: d.taskY }, store.zones);
    const after = selectZonesContainingTask({ x: finalX, y: finalY }, store.zones);
    const leaveTags = before
      .filter((z) => z.autoTag && !after.some((a) => a.id === z.id))
      .map((z) => z.autoTag!);
    const enterTags = after
      .filter((z) => z.autoTag && !before.some((b) => b.id === z.id))
      .map((z) => z.autoTag!);
    let tags = task.tags;
    if (leaveTags.length || enterTags.length) {
      tags = [...new Set([...task.tags.filter((t) => !leaveTags.includes(t)), ...enterTags])];
    }

    store
      .patchTask(task.id, {
        x: finalX,
        y: finalY,
        z: topZ,
        ...(tags !== task.tags ? { tags } : {}),
      })
      .catch((err) => console.error(err));
  };

  const startLink = (e: React.PointerEvent) => {
    e.stopPropagation();
    useStore.getState().setLinking({
      fromId: task.id,
      x: task.x + CARD_W,
      y: task.y + CARD_H / 2,
    });
  };

  const snooze = (until: Date) => {
    setSnoozeOpen(false);
    const store = useStore.getState();
    store
      .patchTask(task.id, { snoozedUntil: until.toISOString() })
      .then(() => store.showToast(t("b.card.toast.snoozed", { title: task.title, date: until.toLocaleDateString(dateLocale()) })))
      .catch((err) => console.error(err));
  };

  // Lens halo
  let halo: string | null = null;
  if (lens === "gravity" && days !== null && !task.done) halo = urgencyColor(days);
  if (lens === "heat" && !task.done) {
    const stale = Math.floor((Date.now() - Date.parse(task.lastActivityAt)) / 86_400_000);
    halo = stalenessColor(stale);
  }

  const renderX = timeLens ? projectTimeX(task, timeOriginX!) + (timeDrag?.dx ?? 0) : task.x;
  const renderY = timeLens ? task.y + (timeDrag?.dy ?? 0) : task.y;
  const checklistDone = task.checklist.filter((c) => c.done).length;

  const priorityLabel = { high: "text-nc-danger", medium: "text-nc-muted", low: "text-nc-faint" } as const;

  const dueBadge =
    days === null ? null : task.done ? (
      <span className="text-nc-faint">{t("b.card.due.label", { date: new Date(task.dueDate!).toLocaleDateString(dateLocale()) })}</span>
    ) : days < 0 ? (
      <span className="text-nc-danger font-medium">{t("b.card.due.overdue", { n: -days })}</span>
    ) : days === 0 ? (
      <span className="text-nc-warning font-medium">{t("b.card.due.today")}</span>
    ) : (
      <span className="text-nc-muted">{t("b.card.due.left", { n: days })}</span>
    );

  return (
    <motion.div
      // Pin left/top in `initial` so the card appears exactly at its spot
      // (scale-pops in place) instead of flying in from the canvas origin.
      // `y` is a transform, independent of the layout position, so it gives a
      // subtle rise-and-settle without moving where the card actually lands.
      initial={reducedMotion ? false : { opacity: 0, scale: 0.6, y: 12, left: renderX, top: renderY }}
      animate={{
        opacity: dimmed ? 0.2 : archived ? 0.5 : task.done ? 0.55 : 1,
        scale: isDragging || focused ? 1.04 : 1,
        y: 0,
        left: renderX,
        top: renderY,
      }}
      transition={taskCardTransition(reducedMotion, isDragging)}
      className={`absolute w-64 rounded-nc-lg bg-nc-raised/95 backdrop-blur-md border focus-visible:outline-solid focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-nc-focus ${
        overdue ? "border-nc-danger" : archived ? "border-dashed border-nc-line" : "border-nc-line-faint"
      } ${isDragging ? "shadow-nc-lg ring-2 ring-nc-line-strong cursor-grabbing" : "shadow-nc-md cursor-grab"} ${
        flashing
          ? "ring-4 ring-nc-accent"
          : focused
            ? "ring-2 ring-nc-accent"
            : selected
              ? "ring-2 ring-nc-select"
              : ""
      } ${overdue && lens === "gravity" && !reducedMotion ? "animate-pulse" : ""}`}
      style={{
        zIndex: isDragging ? 9999 : task.z,
        width: CARD_W,
        height: CARD_H,
        "--semantic-card-scale": density.scale,
        boxShadow: halo ? `0 0 30px 8px ${halo}` : undefined,
        filter: blocked && !task.done ? "saturate(0.45)" : undefined,
      } as React.CSSProperties}
      tabIndex={0}
      data-tour="task-card"
      aria-label={task.title || t("b.card.untitled")}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit(task);
      }}
    >
      {/* Accent strip — the task's color, falling back to an id-seeded gradient */}
      <div className="rounded-t-nc-lg" style={{ height: 8 * density.scale, background: task.color || cardGradient(task.id) }} />

      {/* Dependency port: drag from here onto another card to link */}
      {!readOnly && (
        <div
          data-port
          onPointerDown={startLink}
          title={t("b.card.linkPort.title")}
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-nc-raised border-2 border-nc-accent-border hover:border-nc-accent hover:scale-125 transition-all cursor-crosshair"
        />
      )}

      {/* Mini density: one compact row — title, sync status, due, priority dot */}
      {mini && (
        <div className="px-3 py-2 flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              task.priority === "high" ? "bg-nc-danger" : task.priority === "low" ? "bg-nc-faint" : "bg-nc-muted"
            }`}
            title={t(`b.priority.${task.priority}`)}
          />
          <div className={`flex-1 min-w-0 truncate text-xs font-semibold ${task.done ? "line-through text-nc-faint" : ""}`}>
            {blocked && !task.done && <span title={t("b.card.blocked")} className="mr-1 inline-flex translate-y-0.5 text-nc-faint"><IconLock size={16} /></span>}
            {task.title || t("b.card.untitled")}
          </div>
          {task.externalKey && (
            <span
              className="text-2xs text-nc-accent shrink-0 max-w-24 truncate"
              title={task.status ?? (externalRef ? `${externalRef[1]}#${externalRef[2]}` : undefined)}
            >
              ⑂{task.status ? ` ${task.status}` : ""}
            </span>
          )}
          {dueBadge && <span className="text-2xs shrink-0">{dueBadge}</span>}
        </div>
      )}

      {!mini && (
      <div className="p-4" style={{ padding: 16 * density.scale }}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className={`text-sm font-semibold ${task.done ? "line-through text-nc-faint" : ""}`}>
            {blocked && !task.done && <span title={t("b.card.blocked")} className="mr-1 inline-flex translate-y-0.5 text-nc-faint"><IconLock size={16} /></span>}
            {task.title || t("b.card.untitled")}
          </div>
          <span
            className={`text-xs uppercase tracking-wider shrink-0 ${
              priorityLabel[task.priority as keyof typeof priorityLabel] ?? "text-nc-faint"
            }`}
          >
            {t(`b.priority.${task.priority}`)}
          </span>
        </div>

        {isSemanticDensity && (
          <div className="mb-1.5 text-xs text-nc-accent-strong">
            {task.status ?? t(`b.priority.${task.priority}`)}
          </div>
        )}

        {/* External sync badge + status columns */}
        {task.externalKey && !isSemanticDensity && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <a
              href={task.externalUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              className="text-xs text-nc-faint hover:text-nc-text transition-colors whitespace-nowrap"
              title={t("b.card.openGithub")}
            >
              ⑂ {externalRef ? `${externalRef[1]}#${externalRef[2]}` : "linked"}
            </a>
            {!readOnly && statusColumns.length > 0 && (
              <select
                value={task.status ?? ""}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) =>
                  useStore.getState().patchTask(task.id, { status: e.target.value }).catch((err) => console.error(err))
                }
                className="text-xs bg-nc-well/70 border border-nc-accent-border rounded-full px-1.5 py-0.5 text-nc-accent cursor-pointer"
                title={t("b.card.statusColumn")}
              >
                {/* No synced status yet: without this the browser would show
                    the first column and fake a "Backlog"-like status. */}
                {!task.status && <option value="" disabled>—</option>}
                {task.status && !statusColumns.some((c) => c.name === task.status) && (
                  <option value={task.status}>{task.status}</option>
                )}
                {statusColumns.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            )}
            {readOnly && task.status && (
              <span className="text-xs text-nc-accent border border-nc-accent-border rounded-full px-1.5 py-0.5">
                {task.status}
              </span>
            )}
          </div>
        )}

        {showDescription && task.description && (
          <div className="text-xs text-nc-muted line-clamp-2 mb-2">{task.description}</div>
        )}

        {showTags && task.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-1">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded-nc-sm text-xs bg-nc-fill border border-nc-line-faint text-nc-soft"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {(dueBadge || archived || task.estimateMinutes || task.recurrence || task.checklist.length > 0) && (
          <div className="flex items-center gap-2 text-xs mt-1 flex-wrap">
            {dueBadge}
            {showSummaryMetadata && task.estimateMinutes != null && (
              <span className="inline-flex items-center gap-1 text-nc-muted"><IconHourglass size={16} />{formatMinutes(task.estimateMinutes)}</span>
            )}
            {showSummaryMetadata && task.recurrence && <span className="text-nc-faint" title={t("b.card.recurring")}>↻</span>}
            {showSummaryMetadata && task.checklist.length > 0 && (
              <span
                className={`flex items-center gap-1 ${
                  checklistDone === task.checklist.length ? "text-nc-success" : "text-nc-muted"
                }`}
                title={t("b.card.checklistProgress")}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" className="-rotate-90">
                  <circle cx="6" cy="6" r="5" fill="none" stroke="var(--nc-border-faint)" strokeWidth="2" />
                  <circle
                    cx="6"
                    cy="6"
                    r="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={`${(checklistDone / task.checklist.length) * 31.4} 31.4`}
                    strokeLinecap="round"
                  />
                </svg>
                {checklistDone}/{task.checklist.length}
              </span>
            )}
            {archived && <span className="text-nc-faint italic">{t("b.card.archived")}</span>}
          </div>
        )}

        {/* Estimate vs actual (fed by the focus timer) */}
        {showSummaryMetadata && task.estimateMinutes != null && task.actualMinutes > 0 && (
          <div
            className="mt-1.5 h-1 rounded-full bg-nc-fill-faint overflow-hidden"
            title={t("b.card.estimateVsActual", { actual: formatMinutes(task.actualMinutes), estimate: formatMinutes(task.estimateMinutes) })}
          >
            <div
              className={`h-full ${task.actualMinutes <= task.estimateMinutes ? "bg-nc-accent" : "bg-nc-warning"}`}
              style={{
                width: `${Math.min(task.actualMinutes / task.estimateMinutes, 1.5) / 1.5 * 100}%`,
              }}
            />
          </div>
        )}

        <button
          onClick={() =>
            useStore.getState().patchTask(task.id, { done: !task.done }).catch((e) => console.error(e))
          }
          className="mt-2 w-full text-left text-xs transition-colors"
          disabled={readOnly}
          style={readOnly ? { display: "none" } : undefined}
        >
          {task.done ? (
            <span className="text-nc-faint hover:text-nc-soft">✓ {t("b.card.markUndone")}</span>
          ) : (
            <span className="text-nc-muted hover:text-nc-success transition-colors">○ {t("b.card.markDone")}</span>
          )}
        </button>

        {/* Icon action row — every button carries its label via aria-label + title. */}
        <div className="flex gap-1 mt-1.5 relative" style={readOnly ? { display: "none" } : undefined}>
          <button
            onClick={() => onEdit(task)}
            aria-label={t("b.card.edit")}
            title={t("b.card.edit")}
            className="rounded-nc-sm p-1 text-nc-faint hover:bg-nc-fill-faint hover:text-nc-text transition-colors"
          >
            <IconPencil size={16} />
          </button>
          {archived ? (
            <button
              onClick={() =>
                useStore.getState().patchTask(task.id, { archivedAt: null }).catch((e) => console.error(e))
              }
              aria-label={t("b.card.restore")}
              title={t("b.card.restore")}
              className="rounded-nc-sm p-1 text-nc-faint hover:bg-nc-fill-faint hover:text-nc-success transition-colors"
            >
              <IconRestore size={16} />
            </button>
          ) : (
            <>
              <button
                onClick={() =>
                  useStore
                    .getState()
                    .patchTask(task.id, { archivedAt: new Date().toISOString() })
                    .catch((e) => console.error(e))
                }
                aria-label={t("b.card.archive")}
                title={t("b.card.archive")}
                className="rounded-nc-sm p-1 text-nc-faint hover:bg-nc-fill-faint hover:text-nc-soft transition-colors"
              >
                <IconArchive size={16} />
              </button>
              <button
                onClick={() => setSnoozeOpen(!snoozeOpen)}
                aria-label={t("b.card.snooze")}
                title={t("b.card.snooze")}
                className="rounded-nc-sm p-1 text-nc-faint hover:bg-nc-fill-faint hover:text-nc-text transition-colors"
              >
                <IconClock size={16} />
              </button>
            </>
          )}
          <button
            onClick={() => useStore.getState().deleteTask(task.id).catch((e) => console.error(e))}
            aria-label={t("b.card.delete")}
            title={t("b.card.delete")}
            className="rounded-nc-sm p-1 text-nc-faint hover:bg-nc-fill-faint hover:text-nc-danger transition-colors"
          >
            <IconTrash size={16} />
          </button>

          {snoozeOpen && (
            <MenuPanel className="absolute bottom-5 left-0 z-50 flex flex-col gap-1 rounded-nc-md bg-nc-well border border-nc-line p-2 shadow-nc-lg w-40">
              <button
                onClick={() => snooze(new Date(startOfDay(new Date()).getTime() + 86_400_000))}
                className="text-left text-xs text-nc-soft hover:text-nc-text px-1.5 py-1 rounded-nc-sm hover:bg-nc-fill-faint"
              >
                {t("b.card.snooze.tomorrow")}
              </button>
              <button
                onClick={() => snooze(new Date(startOfDay(new Date()).getTime() + 7 * 86_400_000))}
                className="text-left text-xs text-nc-soft hover:text-nc-text px-1.5 py-1 rounded-nc-sm hover:bg-nc-fill-faint"
              >
                {t("b.card.snooze.nextWeek")}
              </button>
              <input
                type="date"
                onChange={(e) => {
                  if (e.target.value) snooze(new Date(e.target.value));
                }}
                className="text-xs bg-nc-raised border border-nc-line-faint rounded-nc-sm px-1.5 py-1 text-nc-soft"
              />
            </MenuPanel>
          )}
        </div>
      </div>
      )}
    </motion.div>
  );
}
