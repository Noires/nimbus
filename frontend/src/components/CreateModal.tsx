import { dialogSpring, quickFade } from "../utils/motion";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useStore, CARD_W, CARD_H, type Task } from "../store";
import { api, type TaskEvent } from "../data/api";
import { ESTIMATE_CHOICES, formatMinutes } from "../utils/capacity";
import { quickParseTokens } from "../utils/quickParse";
import { findSimilar } from "../utils/similarity";
import { CommentsSection } from "./CommentsSection";
import { useT, dateLocale } from "../i18n";

export interface TaskFormData {
  title: string;
  description: string;
  tags: string[];
  dueDate: string | null;
  priority: string;
  color?: string;
  estimateMinutes: number | null;
  recurrence: string | null;
}

const RECURRENCE_CHOICES: Array<{ labelKey: string; value: string | null }> = [
  { labelKey: "b.modal.recurrence.none", value: null },
  { labelKey: "b.modal.recurrence.daily", value: '{"unit":"day","every":1}' },
  { labelKey: "b.modal.recurrence.weekly", value: '{"unit":"week","every":1}' },
  { labelKey: "b.modal.recurrence.biweekly", value: '{"unit":"week","every":2}' },
  { labelKey: "b.modal.recurrence.monthly", value: '{"unit":"month","every":1}' },
];

// Header strip for synced tasks: repo link + live status select (patches
// immediately, not on submit — Cancel must not discard a status change the
// user already saw applied).
function SyncedHeader({ task }: { task: Task }) {
  const t = useT();
  const live = useStore((s) => s.tasks.find((t) => t.id === task.id)) ?? task;
  const connection = useStore((s) =>
    task.connectionId ? s.connections.find((c) => c.id === task.connectionId) : undefined,
  );
  const externalRef = task.externalKey?.match(/^[^:]+:([^#]+)#(\d+)$/);
  const columns = connection?.columnsCache ?? [];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <a
        href={task.externalUrl ?? undefined}
        target="_blank"
        rel="noreferrer"
        className="text-2xs text-nc-muted hover:text-nc-text transition-colors"
      >
        ⑂ {externalRef ? `${externalRef[1]}#${externalRef[2]}` : t("b.modal.synced.linkedIssue")} · {t("b.modal.synced.openGithub")} ↗
      </a>
      {columns.length > 0 && (
        <select
          value={live.status ?? ""}
          onChange={(e) =>
            useStore.getState().patchTask(task.id, { status: e.target.value }).catch((err) => console.error(err))
          }
          className="text-xs bg-nc-well/70 border border-nc-accent-border rounded-full px-2 py-0.5 text-nc-accent cursor-pointer"
          title={t("b.modal.synced.statusColumn")}
        >
          {live.status && !columns.some((c) => c.name === live.status) && (
            <option value={live.status}>{live.status}</option>
          )}
          {columns.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      )}
      {connection?.status === "error" && (
        <span className="text-2xs text-nc-danger" title={connection.statusMessage ?? undefined}>
          ⚠ {t("b.modal.synced.syncError")}
        </span>
      )}
    </div>
  );
}

function ChecklistSection({ taskId }: { taskId: string }) {
  const t = useT();
  // Live task from the store so checklist mutations render immediately.
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId));
  const [text, setText] = useState("");
  if (!task) return null;

  const add = async () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    await useStore.getState().addChecklistItem(taskId, value).catch((e) => console.error(e));
  };

  const toggle = async (itemId: string, done: boolean) => {
    const store = useStore.getState();
    await store.patchChecklistItem(taskId, itemId, { done }).catch((e) => console.error(e));
    const updated = useStore.getState().tasks.find((t) => t.id === taskId);
    if (
      done &&
      updated &&
      !updated.done &&
      updated.checklist.length > 0 &&
      updated.checklist.every((c) => c.done) &&
      confirm(t("b.modal.checklist.confirmDone"))
    ) {
      await store.patchTask(taskId, { done: true }).catch((e) => console.error(e));
    }
  };

  return (
    <div>
      <span className="block text-xs text-nc-faint mb-1.5">
        {t("b.modal.checklist.label")}{" "}
        {task.checklist.length > 0 &&
          `(${task.checklist.filter((c) => c.done).length}/${task.checklist.length})`}
      </span>
      <div className="flex flex-col gap-1 mb-1.5">
        {task.checklist.map((item) => (
          <div key={item.id} className="group flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.done}
              onChange={(e) => void toggle(item.id, e.target.checked)}
              className="accent-nc-select"
            />
            <span className={`text-xs flex-1 ${item.done ? "line-through text-nc-faint" : "text-nc-soft"}`}>
              {item.text}
            </span>
            <button
              type="button"
              onClick={() => void useStore.getState().removeChecklistItem(taskId, item.id).catch((e) => console.error(e))}
              className="opacity-0 group-hover:opacity-100 text-nc-faint hover:text-nc-danger text-xs transition-all"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void add();
          }
        }}
        placeholder={t("b.modal.checklist.addStep")}
        className="w-full px-3 py-1.5 rounded-nc-md bg-nc-well/60 border border-nc-line-faint text-xs transition-colors"
      />
    </div>
  );
}

function HistorySection({ taskId }: { taskId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<TaskEvent[] | null>(null);

  useEffect(() => {
    if (open && events === null) {
      api
        .taskEvents(taskId)
        .then(({ events }) => setEvents(events))
        .catch(() => setEvents([]));
    }
  }, [open, events, taskId]);

  const describe = (e: TaskEvent): string => {
    if (e.type === "created") return t("b.modal.history.created");
    if (e.type === "moved") return t("b.modal.history.moved");
    if (e.type === "completed") return t("b.modal.history.completed");
    if (e.type === "updated") {
      const fields = Object.keys((e.payload.fields as Record<string, unknown>) ?? {});
      return t("b.modal.history.edited", { fields: fields.join(", ") });
    }
    return e.type;
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-nc-faint hover:text-nc-soft transition-colors"
      >
        {open ? "▾" : "▸"} {t("b.modal.history.label")}
      </button>
      {open && (
        <div className="mt-1.5 max-h-32 overflow-y-auto flex flex-col gap-1 pr-1">
          {events === null && <span className="text-2xs text-nc-faint">{t("b.modal.history.loading")}</span>}
          {events?.length === 0 && <span className="text-2xs text-nc-faint">{t("b.modal.history.none")}</span>}
          {events?.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-2xs">
              <span className="text-nc-muted">{describe(e)}</span>
              <span className="text-nc-faint">{new Date(e.createdAt).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CreateModalProps {
  /** When set, the modal edits this task instead of creating a new one. */
  initial?: Task | null;
  /** "panel" docks the form to the right edge with internal scrolling —
   *  used for editing, where checklist/comments/history can grow tall. */
  variant?: "modal" | "panel";
  onClose: () => void;
  onSubmit: (data: TaskFormData) => void;
}

const SWATCHES = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
];

export function CreateModal({ initial, variant = "modal", onClose, onSubmit }: CreateModalProps) {
  const t = useT();
  const reducedMotion = useReducedMotion();
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tagsInput, setTagsInput] = useState(initial?.tags.join(", ") ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ? initial.dueDate.slice(0, 10) : "");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  // "" = auto color (server picks a deterministic hue on create)
  const [color, setColor] = useState(isEdit ? initial!.color : "");
  const [estimate, setEstimate] = useState<number | null>(initial?.estimateMinutes ?? null);
  const [recurrence, setRecurrence] = useState<string | null>(initial?.recurrence ?? null);

  // Quick-add grammar in the title field (create mode): "friday 2h #api !high …"
  const parsed = !isEdit && title.trim() ? quickParseTokens(title) : null;
  const grammarTokens = parsed?.tokens.filter((t) => t.kind !== "title" && t.kind !== "bubble") ?? [];
  const allTasks = useStore((s) => s.tasks);
  const similar = !isEdit && title.trim().length >= 4 ? findSimilar(title, allTasks) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fields = parsed?.fields;
    const cleanTitle = (fields?.title || title).trim();
    if (!cleanTitle) return;

    onSubmit({
      title: cleanTitle,
      description: description.trim(),
      tags: [
        ...new Set([
          ...tagsInput.split(',').map(t => t.trim()).filter(Boolean),
          ...(fields?.tags ?? []),
        ]),
      ],
      dueDate: dueDate
        ? new Date(dueDate).toISOString()
        : fields?.dueDate ?? null,
      priority: priority === "medium" && fields?.priority ? fields.priority : priority,
      color: color || undefined,
      estimateMinutes: estimate ?? fields?.estimateMinutes ?? null,
      recurrence,
    });
    onClose();
  };

  const CHIP_COLORS: Record<string, string> = {
    date: "text-nc-accent border-nc-accent-border",
    duration: "text-nc-select border-nc-select-border",
    tag: "text-nc-soft border-nc-line-strong",
    priority: "text-nc-danger border-nc-danger-border",
  };

  const isPanel = variant === "panel";
  return (
    <div className={`fixed inset-0 z-[100] flex ${isPanel ? "justify-end" : "items-center justify-center px-4"}`}>
      {/* Backdrop — lighter for the panel so the canvas stays visible */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={quickFade}
        className={`absolute inset-0 ${isPanel ? "bg-nc-canvas/50" : "bg-nc-scrim"}`}
        onClick={onClose}
      />

      {/* Modal content */}
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : isPanel ? { opacity: 0, x: 40 } : { opacity: 0, y: 24, scale: 0.97 }}
        animate={isPanel ? { opacity: 1, x: 0 } : { opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? quickFade : dialogSpring}
        className={
          isPanel
            ? "relative h-full w-[440px] max-w-[95vw] overflow-y-auto shadow-nc-lg bg-nc-raised/95 backdrop-blur-xl border-l border-nc-line p-6"
            : "relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-nc-xl shadow-nc-lg bg-nc-raised/95 backdrop-blur-xl border border-nc-line p-6"
        }>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-nc-display text-lg font-semibold text-nc-text">{isEdit ? t("b.modal.editTask") : t("b.modal.newTask")}</h2>
          <button
            onClick={onClose}
            className="text-nc-faint hover:text-nc-text transition-colors"
          >
            ×
          </button>
        </div>
        {isEdit && initial!.externalKey && <SyncedHeader task={initial!} />}
        <div className="mb-3" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title (required) */}
          <div>
            <label htmlFor="title" className="block text-xs text-nc-faint mb-1">
              {t("b.modal.field.title")} *
            </label>
            <input
              id="title"
              type="text"
              placeholder={t("b.modal.title.placeholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-nc-md bg-nc-well/60 border border-nc-line-faint text-sm transition-colors"
              autoFocus
            />
            {grammarTokens.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1.5">
                {grammarTokens.map((t, i) => (
                  <span key={i} className={`px-1.5 py-0.5 rounded-full border text-2xs ${CHIP_COLORS[t.kind] ?? ""}`}>
                    {t.text}
                  </span>
                ))}
                <span className="text-2xs text-nc-faint self-center">{t("b.modal.parsedOnSave")}</span>
              </div>
            )}
            {similar && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  const store = useStore.getState();
                  store.flyTo(similar.x + CARD_W / 2, similar.y + CARD_H / 2, 1);
                  store.flashTask(similar.id);
                }}
                onMouseEnter={() => useStore.getState().flashTask(similar.id)}
                className="mt-1.5 text-left text-2xs text-nc-warning hover:text-nc-warning transition-colors"
                title={t("b.modal.similar.tooltip")}
              >
                ≈ {t("b.modal.similar.label")}: {similar.title}
                {similar.done
                  ? ` (${t("b.modal.similar.done")})`
                  : similar.dueDate
                    ? ` — ${t("b.modal.similar.due", { date: new Date(similar.dueDate).toLocaleDateString(dateLocale()) })}`
                    : ""}
              </button>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="desc" className="block text-xs text-nc-faint mb-1">
              {t("b.modal.field.description")}
            </label>
            <textarea
              id="desc"
              placeholder={t("b.modal.description.placeholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-nc-md bg-nc-well/60 border border-nc-line-faint text-sm transition-colors resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-xs text-nc-faint mb-1">
              {t("b.modal.field.tags")}
            </label>
            <input
              id="tags"
              type="text"
              placeholder={t("b.modal.tags.placeholder")}
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full px-3 py-2 rounded-nc-md bg-nc-well/60 border border-nc-line-faint text-sm transition-colors"
            />
          </div>

          {/* Priority + Due Date (row) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="priority" className="block text-xs text-nc-faint mb-1">
                {t("b.modal.field.priority")}
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-nc-md bg-nc-well/60 border border-nc-line-faint text-sm transition-colors"
              >
                <option value="high">{t("b.modal.priority.high")}</option>
                <option value="medium">{t("b.modal.priority.medium")}</option>
                <option value="low">{t("b.modal.priority.low")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="dueDate" className="block text-xs text-nc-faint mb-1">
                {t("b.modal.field.dueDate")}
              </label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-nc-md bg-nc-well/60 border border-nc-line-faint text-sm transition-colors"
              />
            </div>
          </div>

          {/* Estimate + Recurrence (row) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-xs text-nc-faint mb-1.5">{t("b.modal.field.estimate")}</span>
              <div className="flex items-center gap-1 flex-wrap">
                {ESTIMATE_CHOICES.map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => setEstimate(estimate === min ? null : min)}
                    className={`h-6 px-2 rounded-full text-2xs border transition-all ${
                      estimate === min
                        ? "border-nc-select text-nc-select bg-nc-select-muted"
                        : "border-nc-line text-nc-muted hover:border-nc-line-strong"
                    }`}
                  >
                    {formatMinutes(min)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="recurrence" className="block text-xs text-nc-faint mb-1.5">
                {t("b.modal.field.repeats")}
              </label>
              <select
                id="recurrence"
                value={recurrence ?? ""}
                onChange={(e) => setRecurrence(e.target.value || null)}
                className="w-full px-3 py-2 rounded-nc-md bg-nc-well/60 border border-nc-line-faint text-sm transition-colors"
              >
                {RECURRENCE_CHOICES.map((c) => (
                  <option key={c.labelKey} value={c.value ?? ""}>
                    {t(c.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Color */}
          <div>
            <span className="block text-xs text-nc-faint mb-1.5">{t("b.modal.field.color")}</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => setColor("")}
                  className={`h-6 px-2 rounded-full text-2xs border transition-all ${
                    color === ""
                      ? "border-white/60 text-nc-text"
                      : "border-nc-line text-nc-muted hover:border-nc-line-strong"
                  }`}
                >
                  {t("b.modal.color.auto")}
                </button>
              )}
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    color === swatch ? "ring-2 ring-white/70 scale-110" : "hover:scale-110"
                  }`}
                  style={{ background: swatch }}
                  title={swatch}
                />
              ))}
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#6366f1"}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 rounded-full bg-transparent border border-nc-line cursor-pointer"
                title={t("b.modal.color.custom")}
              />
            </div>
          </div>

          {/* Checklist + Comments + History (existing tasks only) */}
          {isEdit && <ChecklistSection taskId={initial!.id} />}
          {isEdit && initial!.externalKey && <CommentsSection taskId={initial!.id} />}
          {isEdit && initial!.checklist.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onClose();
                useStore.getState().splitTaskAction(initial!.id).catch((e) => console.error(e));
              }}
              className="w-full py-1.5 rounded-nc-md text-xs text-nc-accent border border-nc-accent-border hover:bg-nc-accent-muted transition-colors"
              title={t("b.modal.splitChecklist.title")}
            >
              ⚛ {t("b.modal.splitChecklist")}
            </button>
          )}
          {isEdit && <HistorySection taskId={initial!.id} />}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-nc-md border border-nc-line-faint text-sm transition-colors hover:bg-nc-fill-faint"
            >
              {t("b.modal.cancel")}
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className={`flex-1 py-2.5 rounded-nc-md text-sm font-medium transition-all ${
                title.trim()
                  ? 'bg-nc-select-surface/80 hover:bg-nc-select-surface text-nc-text shadow-nc-md shadow-nc-select-surface/30'
                  : 'bg-nc-fill text-nc-muted cursor-not-allowed'
              }`}
            >
              {isEdit ? t("b.modal.save") : t("b.modal.create")}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
