import { useMemo, useState } from "react";
import { useStore, visibleTasks, matchesSearch, CARD_W, CARD_H, type Task } from "../store";
import { formatMinutes } from "../utils/capacity";
import { useT, dateLocale } from "../i18n";

type SortKey = "title" | "bubble" | "dueDate" | "priority" | "estimateMinutes" | "done";

// The Ledger: a dense sortable table that is still a CAMERA onto the canvas —
// clicking a row flips back and flies to the card.
export function TableView({ onExit }: { onExit: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const bubbles = useStore((s) => s.bubbles);
  const showDone = useStore((s) => s.showDone);
  const showArchived = useStore((s) => s.showArchived);
  const searchQuery = useStore((s) => s.searchQuery);
  const readOnly = useStore((s) => s.readOnly);
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [asc, setAsc] = useState(true);
  const tr = useT();

  const bubbleTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bubbles) {
      if (!b.title) continue;
      for (const id of b.memberIds) map.set(id, b.title);
    }
    return map;
  }, [bubbles]);

  const prioRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const rows = useMemo(() => {
    const shown = visibleTasks(tasks, showDone, showArchived).filter((t) =>
      matchesSearch(t, searchQuery),
    );
    const dir = asc ? 1 : -1;
    const val = (t: Task): string | number => {
      switch (sortKey) {
        case "title": return t.title.toLowerCase();
        case "bubble": return bubbleTitle.get(t.id) ?? "￿";
        case "dueDate": return t.dueDate ? Date.parse(t.dueDate) : Number.MAX_SAFE_INTEGER;
        case "priority": return prioRank[t.priority] ?? 3;
        case "estimateMinutes": return t.estimateMinutes ?? -1;
        case "done": return t.done ? 1 : 0;
      }
    };
    return [...shown].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, showDone, showArchived, searchQuery, sortKey, asc, bubbleTitle]);

  const jump = (task: Task) => {
    onExit();
    const store = useStore.getState();
    store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, 1);
    store.flashTask(task.id);
  };

  const header = (key: SortKey, label: string) => (
    <th
      className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-300 select-none whitespace-nowrap"
      onClick={() => {
        if (sortKey === key) setAsc(!asc);
        else {
          setSortKey(key);
          setAsc(true);
        }
      }}
    >
      {label} {sortKey === key ? (asc ? "▲" : "▼") : ""}
    </th>
  );

  return (
    <div className="absolute inset-0 z-40 bg-[#0f0f13]/98 overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 bg-[#1a1d24]/95 backdrop-blur-md border-b border-white/10">
        <span className="text-xs text-gray-300 font-semibold">
          {tr("c.table.title", { count: rows.length })} <span className="text-gray-600">{tr("c.table.hint")}</span>
        </span>
        <button onClick={onExit} className="text-gray-500 hover:text-gray-200 text-sm">×</button>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/5">
            {header("done", "✓")}
            {header("title", tr("c.table.colTitle"))}
            {header("bubble", tr("c.table.colBubble"))}
            {header("dueDate", tr("c.table.colDue"))}
            {header("priority", tr("c.table.colPriority"))}
            {header("estimateMinutes", tr("c.table.colEst"))}
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-gray-500">{tr("c.table.colTags")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const overdue = !t.done && t.dueDate && Date.parse(t.dueDate) < Date.now();
            return (
              <tr
                key={t.id}
                className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                onClick={() => jump(t)}
              >
                <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={readOnly}
                    onChange={(e) =>
                      useStore.getState().patchTask(t.id, { done: e.target.checked }).catch(console.error)
                    }
                    className="accent-purple-500"
                  />
                </td>
                <td className={`px-3 py-1.5 text-xs ${t.done ? "line-through text-gray-500" : "text-gray-200"}`}>
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: t.color }} />
                  {t.title}
                </td>
                <td className="px-3 py-1.5 text-xs text-gray-400">{bubbleTitle.get(t.id) ?? "—"}</td>
                <td className={`px-3 py-1.5 text-xs whitespace-nowrap ${overdue ? "text-red-400" : "text-gray-400"}`}>
                  {t.dueDate ? new Date(t.dueDate).toLocaleDateString(dateLocale()) : "—"}
                </td>
                <td className="px-3 py-1.5 text-xs">
                  <span className={
                    t.priority === "high" ? "text-red-400" : t.priority === "low" ? "text-green-400" : "text-yellow-400"
                  }>
                    {t.priority === "high"
                      ? tr("c.table.priorityHigh")
                      : t.priority === "low"
                        ? tr("c.table.priorityLow")
                        : tr("c.table.priorityMedium")}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-xs text-gray-400">
                  {t.estimateMinutes != null ? formatMinutes(t.estimateMinutes) : "—"}
                </td>
                <td className="px-3 py-1.5 text-xs text-gray-500 truncate max-w-40">
                  {t.tags.map((tag) => `#${tag}`).join(" ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
