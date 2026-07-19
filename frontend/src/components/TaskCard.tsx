import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useStore, visibleTasks, CARD_W, CARD_H, DAY_W, type Task } from "../store";
import { cardGradient, urgencyColor, stalenessColor } from "../utils/colors";
import { formatMinutes } from "../utils/capacity";
import { resolveOverlap } from "../engine/collision";
import { dayDockHit } from "./DayDock";
import { useT, dateLocale } from "../i18n";

interface TaskCardProps {
  task: Task;
  dimmed: boolean;
  blocked: boolean;
  focused?: boolean;
  selected?: boolean;
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

export function TaskCard({ task, dimmed, blocked, focused, selected, onEdit }: TaskCardProps) {
  const t = useT();
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

    // Group move: commit the whole selection as one batch-undo step.
    if (d.group) {
      store.commitClusterMove(store.selectedIds, d.group).catch((err) => console.error(err));
      return;
    }

    // Shift+click (no movement) toggles lasso membership instead of dragging.
    const moved = Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4;
    if (!moved && e.shiftKey && !timeLens) {
      store.toggleSelected(task.id);
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
    const zonesAt = (x: number, y: number) =>
      store.zones.filter(
        (z) =>
          x + CARD_W / 2 >= z.x && x + CARD_W / 2 <= z.x + z.w &&
          y + CARD_H / 2 >= z.y && y + CARD_H / 2 <= z.y + z.h,
      );
    const before = zonesAt(d.taskX, d.taskY);
    const after = zonesAt(finalX, finalY);
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

  const priorityLabel = { high: "text-red-400", medium: "text-yellow-400", low: "text-green-400" } as const;

  const dueBadge =
    days === null ? null : task.done ? (
      <span className="text-gray-500">{t("b.card.due.label", { date: new Date(task.dueDate!).toLocaleDateString(dateLocale()) })}</span>
    ) : days < 0 ? (
      <span className="text-red-400 font-medium">{t("b.card.due.overdue", { n: -days })}</span>
    ) : days === 0 ? (
      <span className="text-amber-400 font-medium">{t("b.card.due.today")}</span>
    ) : (
      <span className="text-gray-400">{t("b.card.due.left", { n: days })}</span>
    );

  return (
    <motion.div
      // Pin left/top in `initial` so the card appears exactly at its spot
      // (scale-pops in place) instead of flying in from the canvas origin.
      // `y` is a transform, independent of the layout position, so it gives a
      // subtle rise-and-settle without moving where the card actually lands.
      initial={{ opacity: 0, scale: 0.6, y: 12, left: renderX, top: renderY }}
      animate={{
        opacity: dimmed ? 0.2 : archived ? 0.5 : task.done ? 0.55 : 1,
        scale: isDragging || focused ? 1.04 : 1,
        y: 0,
        left: renderX,
        top: renderY,
      }}
      transition={{
        left: isDragging ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 30 },
        top: isDragging ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 30 },
        opacity: { duration: 0.2, ease: "easeOut" },
        scale: { type: "spring", stiffness: 480, damping: 20 },
        y: { type: "spring", stiffness: 480, damping: 22 },
        default: { type: "spring", stiffness: 400, damping: 28 },
      }}
      className={`absolute w-64 rounded-xl bg-[#1a1d24]/95 backdrop-blur-md border ${
        overdue ? "border-red-500/70" : archived ? "border-dashed border-white/20" : "border-white/10"
      } ${isDragging ? "shadow-2xl ring-2 ring-white/20 cursor-grabbing" : "shadow-lg cursor-grab"} ${
        flashing
          ? "ring-4 ring-cyan-300/80"
          : focused
            ? "ring-2 ring-cyan-400/70"
            : selected
              ? "ring-2 ring-purple-400/80"
              : ""
      } ${overdue && lens === "gravity" ? "animate-pulse" : ""}`}
      style={{
        zIndex: isDragging ? 9999 : task.z,
        boxShadow: halo ? `0 0 30px 8px ${halo}` : undefined,
        filter: blocked && !task.done ? "saturate(0.45)" : undefined,
      }}
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
      <div className="h-2 rounded-t-xl" style={{ background: task.color || cardGradient(task.id) }} />

      {/* Dependency port: drag from here onto another card to link */}
      {!readOnly && (
        <div
          data-port
          onPointerDown={startLink}
          title={t("b.card.linkPort.title")}
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#1a1d24] border-2 border-cyan-400/50 hover:border-cyan-300 hover:scale-125 transition-all cursor-crosshair"
        />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className={`text-sm font-semibold ${task.done ? "line-through text-gray-500" : ""}`}>
            {blocked && !task.done && <span title={t("b.card.blocked")}>🔒 </span>}
            {task.title || t("b.card.untitled")}
          </div>
          <span
            className={`text-[10px] uppercase tracking-wide shrink-0 ${
              priorityLabel[task.priority as keyof typeof priorityLabel] ?? "text-gray-500"
            }`}
          >
            {t(`b.priority.${task.priority}`)}
          </span>
        </div>

        {/* External sync badge + status columns */}
        {task.externalKey && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <a
              href={task.externalUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              className="text-[10px] text-gray-500 hover:text-white transition-colors whitespace-nowrap"
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
                className="text-[10px] bg-[#0f0f13]/70 border border-cyan-500/30 rounded-full px-1.5 py-0.5 text-cyan-300 outline-none cursor-pointer"
                title={t("b.card.statusColumn")}
              >
                {task.status && !statusColumns.some((c) => c.name === task.status) && (
                  <option value={task.status}>{task.status}</option>
                )}
                {statusColumns.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            )}
            {readOnly && task.status && (
              <span className="text-[10px] text-cyan-300/80 border border-cyan-500/20 rounded-full px-1.5 py-0.5">
                {task.status}
              </span>
            )}
          </div>
        )}

        {task.description && (
          <div className="text-xs text-gray-400 line-clamp-2 mb-2">{task.description}</div>
        )}

        {task.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-1">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 border border-white/10 text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {(dueBadge || archived || task.estimateMinutes || task.recurrence || task.checklist.length > 0) && (
          <div className="flex items-center gap-2 text-[10px] mt-1 flex-wrap">
            {dueBadge}
            {task.estimateMinutes != null && (
              <span className="text-gray-400">⏱ {formatMinutes(task.estimateMinutes)}</span>
            )}
            {task.recurrence && <span className="text-gray-500" title={t("b.card.recurring")}>↻</span>}
            {task.checklist.length > 0 && (
              <span
                className={`flex items-center gap-1 ${
                  checklistDone === task.checklist.length ? "text-emerald-400" : "text-gray-400"
                }`}
                title={t("b.card.checklistProgress")}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" className="-rotate-90">
                  <circle cx="6" cy="6" r="5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
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
            {archived && <span className="text-gray-500 italic">{t("b.card.archived")}</span>}
          </div>
        )}

        {/* Estimate vs actual (fed by the focus timer) */}
        {task.estimateMinutes != null && task.actualMinutes > 0 && (
          <div
            className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden"
            title={t("b.card.estimateVsActual", { actual: formatMinutes(task.actualMinutes), estimate: formatMinutes(task.estimateMinutes) })}
          >
            <div
              className={`h-full ${task.actualMinutes <= task.estimateMinutes ? "bg-cyan-500/70" : "bg-orange-500/80"}`}
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
            <span className="text-gray-500 hover:text-gray-300">✓ {t("b.card.markUndone")}</span>
          ) : (
            <span className="text-purple-400 hover:text-purple-300">○ {t("b.card.markDone")}</span>
          )}
        </button>

        <div className="flex gap-3 mt-1 relative" style={readOnly ? { display: "none" } : undefined}>
          <button
            onClick={() => onEdit(task)}
            className="text-left text-[10px] text-gray-600 hover:text-gray-200 transition-colors"
          >
            {t("b.card.edit")}
          </button>
          {archived ? (
            <button
              onClick={() =>
                useStore.getState().patchTask(task.id, { archivedAt: null }).catch((e) => console.error(e))
              }
              className="text-left text-[10px] text-gray-600 hover:text-emerald-400 transition-colors"
            >
              {t("b.card.restore")}
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
                className="text-left text-[10px] text-gray-600 hover:text-gray-300 transition-colors"
              >
                {t("b.card.archive")}
              </button>
              <button
                onClick={() => setSnoozeOpen(!snoozeOpen)}
                className="text-left text-[10px] text-gray-600 hover:text-indigo-300 transition-colors"
              >
                {t("b.card.snooze")}
              </button>
            </>
          )}
          <button
            onClick={() => useStore.getState().deleteTask(task.id).catch((e) => console.error(e))}
            className="text-left text-[10px] text-gray-600 hover:text-red-400 transition-colors"
          >
            {t("b.card.delete")}
          </button>

          {snoozeOpen && (
            <div className="absolute bottom-5 left-0 z-50 flex flex-col gap-1 rounded-lg bg-[#0f0f13] border border-white/15 p-2 shadow-2xl w-40">
              <button
                onClick={() => snooze(new Date(startOfDay(new Date()).getTime() + 86_400_000))}
                className="text-left text-xs text-gray-300 hover:text-white px-1.5 py-1 rounded hover:bg-white/5"
              >
                {t("b.card.snooze.tomorrow")}
              </button>
              <button
                onClick={() => snooze(new Date(startOfDay(new Date()).getTime() + 7 * 86_400_000))}
                className="text-left text-xs text-gray-300 hover:text-white px-1.5 py-1 rounded hover:bg-white/5"
              >
                {t("b.card.snooze.nextWeek")}
              </button>
              <input
                type="date"
                onChange={(e) => {
                  if (e.target.value) snooze(new Date(e.target.value));
                }}
                className="text-xs bg-[#1a1d24] border border-white/10 rounded px-1.5 py-1 text-gray-300"
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
