import { IconClose, IconInboxTray } from "./ui/icons";
import { chromeSpring } from "../utils/motion";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, CARD_W, CARD_H } from "../store";
import { quickParseTokens } from "../utils/quickParse";
import { quickCreate } from "../utils/quickCreate";
import { findSimilar } from "../utils/similarity";
import { useT } from "../i18n";

interface InboxDockProps {
  canvasId: string;
  viewportRef: React.RefObject<HTMLElement | null>;
}

// Quick-capture inbox: type-Enter-type-Enter to capture without placing.
// Dragging a mini-card onto the canvas IS the triage step — it becomes a
// full card at the drop point.
export function InboxDock({ canvasId, viewportRef }: InboxDockProps) {
  const open = useStore((s) => s.inboxOpen);
  const setOpen = useStore((s) => s.setInboxOpen);
  const tasks = useStore((s) => s.tasks);
  const [text, setText] = useState("");
  const [ghost, setGhost] = useState<{ id: string; title: string; x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);
  const t = useT();

  const inboxTasks = tasks.filter((t) => t.inbox && !t.archivedAt);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const capture = async () => {
    const input = text.trim();
    if (!input) return;
    setText("");
    try {
      const { fields } = quickParseTokens(input);
      if (!fields.title) return;
      if (fields.bubbleName) {
        // @Bubble targeting places the card directly instead of inboxing it.
        await quickCreate(canvasId, input);
        return;
      }
      await useStore.getState().addTask({
        canvasId,
        title: fields.title,
        tags: fields.tags,
        priority: fields.priority ?? undefined,
        dueDate: fields.dueDate,
        estimateMinutes: fields.estimateMinutes,
        inbox: true,
      });
    } catch (e) {
      console.error(e);
      useStore.getState().showToast(t("c.inbox.captureFailed"));
    }
  };

  const parsedTokens = text.trim() ? quickParseTokens(text).tokens.filter((t) => t.kind !== "title") : [];
  const similar = text.trim().length >= 4 ? findSimilar(text, tasks) : null;

  const CHIP_COLORS: Record<string, string> = {
    date: "text-nc-accent border-nc-accent/40",
    duration: "text-nc-select border-nc-select/40",
    tag: "text-nc-soft border-nc-line-strong",
    priority: "text-nc-danger border-nc-danger/40",
    bubble: "text-nc-warning border-nc-warning/40",
  };

  const startDrag = (e: React.PointerEvent, id: string, title: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragId.current = id;
    setGhost({ id, title, x: e.clientX, y: e.clientY });
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!dragId.current) return;
    setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
  };

  const endDrag = (e: React.PointerEvent) => {
    const id = dragId.current;
    dragId.current = null;
    setGhost(null);
    if (!id) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Dropped outside the canvas area (e.g. back on the dock) → keep in inbox.
    if (e.clientX < rect.left || e.clientX > rect.right - 240 || e.clientY < rect.top) return;
    const store = useStore.getState();
    const x = (e.clientX - rect.left - store.panX) / store.zoom - 128;
    const y = (e.clientY - rect.top - store.panY) / store.zoom - 40;
    const topZ = Math.max(0, ...store.tasks.map((t) => t.z)) + 1;
    store
      .patchTask(id, { inbox: false, x, y, z: topZ })
      .catch((err) => console.error(err));
  };

  return (
    <>
      {/* Toggle tab */}
      <button
        onClick={() => setOpen(!open)}
        className="absolute right-0 top-24 z-40 flex items-center gap-1 rounded-l-nc-md bg-nc-raised/95 border border-r-0 border-nc-line px-2 py-2 text-xs text-nc-muted hover:text-nc-text transition-colors"
        title={t("c.inbox.tooltip")}
        aria-label={t("c.inbox.title")}
      >
        <IconInboxTray size={16} />
        {inboxTasks.length > 0 && (
          <span className="text-2xs text-nc-muted">{inboxTasks.length}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: 260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 260, opacity: 0 }}
            transition={chromeSpring}
            className="absolute right-0 top-24 bottom-24 z-40 w-60 rounded-l-nc-lg bg-nc-raised/95 backdrop-blur-md border border-r-0 border-nc-line shadow-nc-lg flex flex-col"
          >
            <div className="p-3 border-b border-nc-line-faint">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-nc-soft">{t("c.inbox.title")}</span>
                <button onClick={() => setOpen(false)} aria-label={t("c.inbox.close")} title={t("c.inbox.close")} className="rounded-nc-sm p-0.5 text-nc-faint hover:text-nc-text"><IconClose size={16} /></button>
              </div>
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") void capture();
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder={t("c.inbox.placeholder")}
                className="w-full px-2.5 py-1.5 rounded-nc-md bg-nc-well/60 border border-nc-line-faint text-xs transition-colors"
              />
              {parsedTokens.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1.5">
                  {parsedTokens.map((t, i) => (
                    <span
                      key={i}
                      className={`px-1.5 py-0.5 rounded-full border text-2xs ${CHIP_COLORS[t.kind] ?? ""}`}
                    >
                      {t.text}
                    </span>
                  ))}
                </div>
              )}
              {similar && (
                <button
                  onClick={() => {
                    setText("");
                    const store = useStore.getState();
                    store.flyTo(similar.x + CARD_W / 2, similar.y + CARD_H / 2, 1);
                    store.flashTask(similar.id);
                    setOpen(false);
                  }}
                  onMouseEnter={() => useStore.getState().flashTask(similar.id)}
                  className="mt-1.5 w-full text-left text-2xs text-nc-warning/90 hover:text-nc-warning transition-colors"
                  title={t("c.inbox.similarTooltip")}
                >
                  ≈ {t("c.inbox.looksLike")} {similar.title}
                  {similar.done ? ` (${t("c.inbox.done")})` : ""}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
              {inboxTasks.length === 0 && (
                <div className="text-2xs text-nc-faint px-1 py-2">
                  {t("c.inbox.empty")}
                </div>
              )}
              {inboxTasks.map((task) => (
                <div
                  key={task.id}
                  onPointerDown={(e) => startDrag(e, task.id, task.title)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className="group flex items-center gap-2 rounded-nc-md bg-nc-well/70 border border-nc-line-faint px-2.5 py-2 cursor-grab active:cursor-grabbing hover:border-nc-line-strong transition-colors"
                  title={t("c.inbox.dragTooltip")}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: task.color }} />
                  <span className="text-xs text-nc-soft truncate flex-1">{task.title}</span>
                  <button
                    onClick={() => useStore.getState().deleteTask(task.id).catch((err) => console.error(err))}
                    className="opacity-0 group-hover:opacity-100 text-nc-faint hover:text-nc-danger text-xs transition-all"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag ghost following the pointer */}
      {ghost && (
        <div
          className="fixed z-[300] pointer-events-none px-3 py-2 rounded-nc-md bg-nc-raised border border-nc-select/50 shadow-nc-lg text-xs text-nc-text max-w-48 truncate"
          style={{ left: ghost.x + 8, top: ghost.y + 8 }}
        >
          {ghost.title}
        </div>
      )}
    </>
  );
}
