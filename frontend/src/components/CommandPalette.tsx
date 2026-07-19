import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useStore, CARD_W, CARD_H, type Task } from "../store";
import { quickParse } from "../utils/quickParse";
import { quickCreate } from "../utils/quickCreate";
import { useT, useLocale, dateLocale } from "../i18n";

interface PaletteProps {
  canvasId: string | null;
  onNewTask: () => void;
}

interface Result {
  key: string;
  kind: "task" | "canvas" | "bubble" | "action";
  label: string;
  hint?: string;
  color?: string;
  score: number;
  run: () => void;
}

function score(text: string, q: string): number {
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const idx = t.indexOf(q);
  if (idx >= 0) return 60 - Math.min(idx, 40);
  // subsequence match
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 10 : -1;
}

export function CommandPalette({ canvasId, onNewTask }: PaletteProps) {
  const open = useStore((s) => s.paletteOpen);
  const tasks = useStore((s) => s.tasks);
  const canvases = useStore((s) => s.canvases);
  const bubbles = useStore((s) => s.bubbles);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const t = useT();
  const locale = useLocale((s) => s.locale);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const close = () => useStore.getState().setPaletteOpen(false);

  const jumpToTask = (task: Task) => {
    const store = useStore.getState();
    // Make sure the target is actually visible before flying to it.
    if (task.done && !store.showDone) store.toggleShowDone();
    if (task.archivedAt && !store.showArchived) store.toggleShowArchived();
    store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, 1);
    store.flashTask(task.id);
  };

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const store = useStore.getState();

    // "n friday 2h #api !high @Launch fix login" → quick-create via grammar.
    if (query.startsWith("n ") && canvasId) {
      const rest = query.slice(2);
      const parsed = quickParse(rest);
      if (parsed.title) {
        const hints = [
          parsed.dueDate ? t("a.palette.dueHint", { date: new Date(parsed.dueDate).toLocaleDateString(dateLocale()) }) : null,
          parsed.estimateMinutes ? `${parsed.estimateMinutes}m` : null,
          parsed.tags.length ? `#${parsed.tags.join(" #")}` : null,
          parsed.priority,
          parsed.bubbleName ? `→ @${parsed.bubbleName}` : null,
        ].filter(Boolean).join(" · ");
        return [
          {
            key: "quick-create",
            kind: "action",
            label: t("a.palette.create", { title: parsed.title }),
            hint: hints || t("a.palette.enterToCreate"),
            score: 100,
            run: () => void quickCreate(canvasId, rest).catch((e) => console.error(e)),
          },
        ];
      }
    }

    const bubbleFor = (taskId: string) =>
      bubbles.find((b) => b.title && b.memberIds.includes(taskId))?.title;

    const actions: Array<{ label: string; hint?: string; run: () => void }> = [
      { label: t("a.palette.action.newTask"), hint: "N", run: onNewTask },
      { label: t("a.palette.action.fitView"), hint: "F", run: () => store.fitView() },
      { label: t("a.palette.action.resetView"), hint: "R", run: () => store.setView(1, 0, 0) },
      { label: t("a.palette.action.undo"), hint: "Ctrl+Z", run: () => void store.undo() },
      { label: t("a.palette.action.redo"), hint: "Ctrl+Shift+Z", run: () => void store.redo() },
      { label: store.showDone ? t("a.palette.action.hideDone") : t("a.palette.action.showDone"), run: store.toggleShowDone },
      { label: store.showArchived ? t("a.palette.action.hideArchived") : t("a.palette.action.showArchived"), run: store.toggleShowArchived },
      { label: t("a.palette.action.lensTime"), hint: "T", run: () => store.setLens(store.lens === "time" ? "off" : "time") },
      { label: t("a.palette.action.lensGravity"), hint: "G", run: () => store.setLens(store.lens === "gravity" ? "off" : "gravity") },
      { label: t("a.palette.action.lensHeat"), hint: "H", run: () => store.setLens(store.lens === "heat" ? "off" : "heat") },
      { label: t("a.palette.action.lensOff"), run: () => store.setLens("off") },
      { label: store.viewMode === "table" ? t("a.palette.action.canvasView") : t("a.palette.action.ledgerView"), hint: "L", run: () => store.setViewMode(store.viewMode === "table" ? "canvas" : "table") },
      { label: t("a.palette.action.dayDock"), hint: "Y", run: () => store.setDayDockOpen(!store.dayDockOpen) },
      { label: t("a.palette.action.drawZone"), hint: "Z", run: () => store.setZoneDraw(true) },
      { label: t("a.palette.action.quickAdd"), run: () => {} },
      ...(store.connections.length > 0
        ? [{
            label: t("a.palette.action.syncGithub"),
            hint: "↻",
            run: () => {
              for (const conn of useStore.getState().connections) {
                void useStore.getState().syncConnection(conn.id).catch(() => {});
              }
            },
          }]
        : []),
    ];

    const all: Result[] = [];

    for (const task of tasks) {
      const s = q
        ? Math.max(
            score(task.title, q),
            score(task.tags.join(" "), q) - 10,
            score(task.description, q) - 20,
          )
        : 1;
      if (s < 0) continue;
      const inBubble = bubbleFor(task.id);
      all.push({
        key: `task:${task.id}`,
        kind: "task",
        label: task.title,
        hint: [
          task.done ? t("a.palette.hint.done") : null,
          task.archivedAt ? t("a.palette.hint.archived") : null,
          task.inbox ? t("a.palette.hint.inbox") : null,
          inBubble ? t("a.palette.hint.inBubble", { title: inBubble }) : null,
        ]
          .filter(Boolean)
          .join(" · "),
        color: task.color,
        score: s + (task.done || task.archivedAt ? -5 : 0),
        run: () => jumpToTask(task),
      });
    }

    for (const canvas of canvases) {
      const s = q ? score(canvas.name, q) : 0;
      if (s < 0) continue;
      all.push({
        key: `canvas:${canvas.id}`,
        kind: "canvas",
        label: canvas.name,
        hint: canvas.id === canvasId ? t("a.palette.hint.currentCanvas") : t("a.palette.hint.switchCanvas"),
        score: s - 2,
        run: () => navigate(`/canvas/${canvas.id}`),
      });
    }

    for (const bubble of bubbles) {
      if (!bubble.title) continue;
      const s = q ? score(bubble.title, q) : 0;
      if (s < 0) continue;
      all.push({
        key: `bubble:${bubble.id}`,
        kind: "bubble",
        label: bubble.title,
        hint: t("a.palette.hint.bubble", { count: bubble.memberIds.length }),
        score: s,
        run: () => {
          const members = tasks.filter((t) => bubble.memberIds.includes(t.id));
          if (members.length === 0) return;
          const cx = members.reduce((sum, t) => sum + t.x + CARD_W / 2, 0) / members.length;
          const cy = members.reduce((sum, t) => sum + t.y + CARD_H / 2, 0) / members.length;
          useStore.getState().flyTo(cx, cy, 0.7);
        },
      });
    }

    for (const action of actions) {
      const s = q ? score(action.label, q) : 0;
      if (s < 0) continue;
      all.push({
        key: `action:${action.label}`,
        kind: "action",
        label: action.label,
        hint: action.hint,
        score: s - 1,
        run: action.run,
      });
    }

    all.sort((a, b) => b.score - a.score);
    return all.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tasks, canvases, bubbles, canvasId, navigate, onNewTask, locale]);

  if (!open) return null;

  const pick = (r: Result) => {
    close();
    r.run();
  };

  const kindIcon = { task: "◈", canvas: "▦", bubble: "◯", action: "⌘" } as const;

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className="relative w-full max-w-lg rounded-xl bg-[#1a1d24]/95 backdrop-blur-xl border border-white/15 shadow-2xl overflow-hidden"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter" && results[selected]) {
              pick(results[selected]);
            } else if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
          placeholder={t("a.palette.placeholder")}
          className="w-full px-4 py-3 bg-transparent text-sm text-gray-100 outline-none border-b border-white/10 placeholder:text-gray-500"
        />
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-4 py-3 text-xs text-gray-500">{t("a.palette.noMatches")}</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.key}
              onClick={() => pick(r)}
              onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors ${
                i === selected ? "bg-white/10 text-white" : "text-gray-300"
              }`}
            >
              <span className="text-xs text-gray-500 w-4 shrink-0">{kindIcon[r.kind]}</span>
              {r.color && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
              )}
              <span className="truncate flex-1">{r.label}</span>
              {r.hint && <span className="text-[10px] text-gray-500 shrink-0">{r.hint}</span>}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
