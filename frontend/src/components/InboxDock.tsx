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
    date: "text-cyan-300 border-cyan-500/40",
    duration: "text-violet-300 border-violet-500/40",
    tag: "text-gray-300 border-white/25",
    priority: "text-red-300 border-red-500/40",
    bubble: "text-amber-300 border-amber-500/40",
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
        className="absolute right-0 top-24 z-40 flex items-center gap-1 rounded-l-lg bg-[#1a1d24]/90 border border-r-0 border-white/10 px-2 py-2 text-xs text-gray-400 hover:text-white transition-colors"
        title={t("c.inbox.tooltip")}
      >
        📥
        {inboxTasks.length > 0 && (
          <span className="text-[10px] text-purple-300">{inboxTasks.length}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: 260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 260, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className="absolute right-0 top-24 bottom-24 z-40 w-60 rounded-l-xl bg-[#1a1d24]/95 backdrop-blur-md border border-r-0 border-white/10 shadow-2xl flex flex-col"
          >
            <div className="p-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-300">{t("c.inbox.title")}</span>
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-200 text-sm">×</button>
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
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0f0f13]/60 border border-white/10 focus:border-purple-500 text-xs outline-none transition-colors"
              />
              {parsedTokens.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1.5">
                  {parsedTokens.map((t, i) => (
                    <span
                      key={i}
                      className={`px-1.5 py-0.5 rounded-full border text-[9px] ${CHIP_COLORS[t.kind] ?? ""}`}
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
                  className="mt-1.5 w-full text-left text-[10px] text-amber-300/90 hover:text-amber-200 transition-colors"
                  title={t("c.inbox.similarTooltip")}
                >
                  ≈ {t("c.inbox.looksLike")} {similar.title}
                  {similar.done ? ` (${t("c.inbox.done")})` : ""}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
              {inboxTasks.length === 0 && (
                <div className="text-[10px] text-gray-600 px-1 py-2">
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
                  className="group flex items-center gap-2 rounded-lg bg-[#0f0f13]/70 border border-white/10 px-2.5 py-2 cursor-grab active:cursor-grabbing hover:border-white/25 transition-colors"
                  title={t("c.inbox.dragTooltip")}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: task.color }} />
                  <span className="text-xs text-gray-300 truncate flex-1">{task.title}</span>
                  <button
                    onClick={() => useStore.getState().deleteTask(task.id).catch((err) => console.error(err))}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs transition-all"
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
          className="fixed z-[300] pointer-events-none px-3 py-2 rounded-lg bg-[#1a1d24] border border-purple-400/50 shadow-2xl text-xs text-gray-200 max-w-48 truncate"
          style={{ left: ghost.x + 8, top: ghost.y + 8 }}
        >
          {ghost.title}
        </div>
      )}
    </>
  );
}
