import { useEffect, useMemo, useState } from "react";
import { api, type SavedView, type SavedViewConfig, type Task } from "../data/api";

const defaults: SavedViewConfig = { group: "none", sort: "dueDate", direction: "asc" };
const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
function groupKey(task: Task, group: SavedViewConfig["group"]): string {
  if (group === "tag") return [...task.tags].sort()[0] ?? "Untagged";
  if (group === "status") return task.done ? "Completed" : "Open";
  if (group === "priority") return task.priority;
  if (group === "dueDate") return task.dueDate?.slice(0, 10) ?? "No due date";
  return "";
}

/** Deterministic structured projection: normalized field order then immutable id. */
export function selectLedgerTasks(tasks: Task[], config: SavedViewConfig): Task[] {
  const direction = config.direction === "desc" ? -1 : 1;
  const field = config.sort ?? "dueDate";
  return tasks.filter((task) =>
    !task.archivedAt && (config.done === undefined || task.done === config.done)
    && (!config.tag || task.tags.includes(config.tag)) && (!config.priority || task.priority === config.priority),
  ).slice().sort((left, right) => {
    const group = groupKey(left, config.group).localeCompare(groupKey(right, config.group));
    if (group) return group;
    const value = field === "priority"
      ? priorityRank[left.priority] - priorityRank[right.priority]
      : field === "dueDate" ? (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31")
        : field === "createdAt" ? left.createdAt.localeCompare(right.createdAt) : left.title.localeCompare(right.title);
    return value * direction || left.id.localeCompare(right.id);
  });
}

export function LedgerView({ canvasId, tasks, onOpenInspector }: { canvasId: string; tasks: Task[]; onOpenInspector: (task: Task) => void }) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [active, setActive] = useState<SavedViewConfig>(defaults);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void api.listSavedViews(canvasId).then(setViews).catch(() => setError("Saved views could not be loaded.")); }, [canvasId]);
  const rows = useMemo(() => selectLedgerTasks(tasks, active), [tasks, active]);
  const tags = useMemo(() => [...new Set(tasks.flatMap((task) => task.tags))].sort(), [tasks]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!name.trim()) return;
    try { const view = await api.createSavedView({ canvasId, name, config: active }); setViews((items) => [...items, view]); setName(""); }
    catch { setError("Saved view could not be created."); }
  };
  return <section aria-labelledby="ledger-heading" className="space-y-3 p-3">
    <div><h2 id="ledger-heading" className="text-sm font-semibold text-cyan-100">Ledger</h2><p className="text-xs text-gray-400">Structured current task data; saved views store filters and order, never task copies.</p></div>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    <div className="flex flex-wrap gap-2" aria-label="Ledger filters">
      <select aria-label="Completion filter" value={active.done === undefined ? "all" : String(active.done)} onChange={(e) => setActive((value) => ({ ...value, done: e.target.value === "all" ? undefined : e.target.value === "true" }))}><option value="all">All tasks</option><option value="false">Open</option><option value="true">Completed</option></select>
      <select aria-label="Tag filter" value={active.tag ?? ""} onChange={(e) => setActive((value) => ({ ...value, tag: e.target.value || undefined }))}><option value="">All tags</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select>
      <select aria-label="Priority filter" value={active.priority ?? ""} onChange={(e) => setActive((value) => ({ ...value, priority: e.target.value || undefined }))}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
      <select aria-label="Group ledger" value={active.group ?? "none"} onChange={(e) => setActive((value) => ({ ...value, group: e.target.value as SavedViewConfig["group"] }))}><option value="none">No grouping</option><option value="tag">Tag</option><option value="status">Status</option><option value="priority">Priority</option><option value="dueDate">Due date</option></select>
      <select aria-label="Sort ledger" value={active.sort} onChange={(e) => setActive((value) => ({ ...value, sort: e.target.value as SavedViewConfig["sort"] }))}><option value="dueDate">Due date</option><option value="priority">Priority</option><option value="title">Title</option><option value="createdAt">Created</option></select>
      <button type="button" onClick={() => setActive((value) => ({ ...value, direction: value.direction === "asc" ? "desc" : "asc" }))} aria-label="Reverse ledger order">{active.direction === "asc" ? "Ascending" : "Descending"}</button>
    </div>
    <form onSubmit={(event) => void save(event)} className="flex gap-2"><label className="sr-only" htmlFor="ledger-name">Saved view name</label><input id="ledger-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Save this view" maxLength={120}/><button type="submit">Save view</button></form>
    {views.length > 0 && <div className="flex flex-wrap gap-1" aria-label="Saved ledger views">{views.map((view) => <span key={view.id}><button type="button" onClick={() => setActive(view.config)}>{view.name}</button><button type="button" aria-label={`Delete ${view.name}`} onClick={() => void api.deleteSavedView(view.id).then(() => setViews((items) => items.filter((item) => item.id !== view.id))).catch(() => setError("Saved view could not be deleted."))}>×</button></span>)}</div>}
    <p role="status" aria-live="polite" className="text-xs text-gray-400">{rows.length} tasks shown; ordered by {active.sort ?? "due date"}, with ID as the final tie-breaker.</p>
    <div className="overflow-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Ledger task results</caption><thead><tr>{active.group && active.group !== "none" && <th>Group</th>}<th>Task</th><th>Status</th><th>Priority</th><th>Due</th></tr></thead><tbody>{rows.map((task) => <tr key={task.id}>{active.group && active.group !== "none" && <td>{groupKey(task, active.group)}</td>}<td><button type="button" onClick={() => onOpenInspector(task)} className="text-cyan-100 underline">{task.title || "Untitled task"}</button></td><td>{task.done ? "Completed" : "Open"}</td><td>{task.priority}</td><td>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}</td></tr>)}</tbody></table></div>
  </section>;
}
