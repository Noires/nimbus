import { useEffect, useMemo, useState } from "react";
import { api, type SavedView, type SavedViewConfig, type Task } from "../data/api";

const defaults: SavedViewConfig = { group: "none", sort: "dueDate", direction: "asc" };
const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
/** A due instant is always presented and grouped by the user's local calendar day. */
export function localDateKey(value: string | null): string | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  // ISO date-only values describe a local calendar date, not a UTC midnight.
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function groupKey(task: Task, group: SavedViewConfig["group"]): string {
  if (group === "tag") return [...task.tags].sort((a, b) => a.localeCompare(b))[0] ?? "Untagged";
  if (group === "status") return task.done ? "Completed" : "Open";
  if (group === "priority") return task.priority;
  if (group === "dueDate") return localDateKey(task.dueDate) ?? "No due date";
  return "";
}
/** Deterministic structured projection: local-calendar normalized field order then immutable id. */
export function selectLedgerTasks(tasks: Task[], config: SavedViewConfig): Task[] {
  const direction = config.direction === "desc" ? -1 : 1;
  const field = config.sort ?? "dueDate";
  return tasks.filter((task) => !task.archivedAt && (config.done === undefined || task.done === config.done)
    && (!config.tag || task.tags.includes(config.tag)) && (!config.priority || task.priority === config.priority))
    .slice().sort((left, right) => {
      const group = groupKey(left, config.group).localeCompare(groupKey(right, config.group));
      if (group) return group;
      const value = field === "priority" ? priorityRank[left.priority] - priorityRank[right.priority]
        : field === "dueDate" ? (localDateKey(left.dueDate) ?? "9999-12-31").localeCompare(localDateKey(right.dueDate) ?? "9999-12-31")
          : field === "createdAt" ? left.createdAt.localeCompare(right.createdAt) : left.title.localeCompare(right.title);
      return value * direction || left.id.localeCompare(right.id);
    });
}

export function LedgerView({ canvasId, tasks, onOpenInspector }: { canvasId: string; tasks: Task[]; onOpenInspector: (task: Task) => void }) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [active, setActive] = useState<SavedViewConfig>(defaults);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => { void api.listSavedViews(canvasId).then(setViews).catch(() => setError("Saved views could not be loaded.")); }, [canvasId]);
  const rows = useMemo(() => selectLedgerTasks(tasks, active), [tasks, active]);
  const tags = useMemo(() => [...new Set(tasks.flatMap((task) => task.tags))].sort((a, b) => a.localeCompare(b)), [tasks]);
  const change = (next: SavedViewConfig) => { setActive(next); setActiveViewId(null); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!name.trim()) return;
    try { const view = await api.createSavedView({ canvasId, name, config: active }); setViews((items) => [...items, view]); setName(""); setActiveViewId(view.id); setNotice(`Saved view ${view.name}.`); }
    catch { setError("Saved view could not be created."); }
  };
  const remove = async (view: SavedView) => {
    if (!confirm(`Delete saved view “${view.name}”?`)) return;
    try { await api.deleteSavedView(view.id); setViews((items) => items.filter((item) => item.id !== view.id)); if (activeViewId === view.id) setActiveViewId(null); setNotice(`Deleted saved view ${view.name}.`); }
    catch { setError("Saved view could not be deleted."); }
  };
  return <section aria-labelledby="ledger-heading" className="space-y-3 p-3">
    <div><h2 id="ledger-heading" className="text-sm font-semibold text-cyan-100">Ledger</h2><p className="text-xs text-gray-400">Structured current task data; saved views store explicit filters and order, never task copies.</p></div>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}<p role="status" aria-live="polite" className="sr-only">{notice}</p>
    <fieldset className="flex flex-wrap gap-2" aria-describedby="ledger-filter-summary"><legend className="text-xs text-gray-300">Ledger filters and order</legend>
      <label>Completion <select value={active.done === undefined ? "all" : String(active.done)} onChange={(e) => change({ ...active, done: e.target.value === "all" ? undefined : e.target.value === "true" })}><option value="all">All tasks</option><option value="false">Open</option><option value="true">Completed</option></select></label>
      <label>Tag <select value={active.tag ?? ""} onChange={(e) => change({ ...active, tag: e.target.value || undefined })}><option value="">All tags</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
      <label>Priority <select value={active.priority ?? ""} onChange={(e) => change({ ...active, priority: e.target.value || undefined })}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
      <label>Group <select value={active.group ?? "none"} onChange={(e) => change({ ...active, group: e.target.value as SavedViewConfig["group"] })}><option value="none">No grouping</option><option value="tag">Tag</option><option value="status">Status</option><option value="priority">Priority</option><option value="dueDate">Due date (local)</option></select></label>
      <label>Sort <select value={active.sort} onChange={(e) => change({ ...active, sort: e.target.value as SavedViewConfig["sort"] })}><option value="dueDate">Due date (local)</option><option value="priority">Priority</option><option value="title">Title</option><option value="createdAt">Created</option></select></label>
      <button type="button" onClick={() => change({ ...active, direction: active.direction === "asc" ? "desc" : "asc" })}>{active.direction === "asc" ? "Ascending" : "Descending"}</button><button type="button" onClick={() => change(defaults)}>Reset filters</button>
    </fieldset>
    <p id="ledger-filter-summary" className="text-xs text-gray-400">{rows.length} tasks shown; ordered by {active.sort ?? "due date"} {active.direction ?? "asc"}, with ID as the final tie-breaker. Due dates use your local calendar day.</p>
    <form onSubmit={(event) => void save(event)} className="flex gap-2"><label htmlFor="ledger-name">Saved view name</label><input id="ledger-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Save this view" maxLength={120}/><button type="submit">Save view</button></form>
    <div aria-label="Saved ledger views">{views.length === 0 ? <p className="text-xs text-gray-400">No saved views yet.</p> : views.map((view) => <span key={view.id} className="mr-1"><button type="button" aria-current={activeViewId === view.id ? "page" : undefined} onClick={() => { setActive(view.config); setActiveViewId(view.id); setNotice(`Loaded ${view.name}; ${selectLedgerTasks(tasks, view.config).length} tasks shown.`); }}>{view.name}</button><button type="button" aria-label={`Delete ${view.name}`} onClick={() => void remove(view)}>×</button></span>)}</div>
    <div className="overflow-auto"><table className="w-full text-left text-xs"><caption>Ledger task results</caption><thead><tr>{active.group && active.group !== "none" && <th>Group</th>}<th>Task</th><th>Status</th><th>Priority</th><th>Due (local)</th></tr></thead><tbody>{rows.map((task) => <tr key={task.id}>{active.group && active.group !== "none" && <td>{groupKey(task, active.group)}</td>}<td><button type="button" onClick={() => onOpenInspector(task)} className="text-cyan-100 underline">{task.title || "Untitled task"}</button></td><td>{task.done ? "Completed" : "Open"}</td><td>{task.priority}</td><td>{localDateKey(task.dueDate) ?? "No due date"}</td></tr>)}</tbody></table>{rows.length === 0 && <p role="status">No tasks match these filters. Use Reset filters to show all current tasks.</p>}</div>
  </section>;
}
