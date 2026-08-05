import { useEffect, useMemo, useRef, useState } from "react";
import { api, type SavedView, type SavedViewConfig, type Task } from "../data/api";
import { useT } from "../i18n";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";

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

// Controls use the shared ui/ primitives (Button, Input, Select).
const labelCls = "flex items-center gap-1.5 text-xs text-nc-muted";

export function LedgerView({ canvasId, tasks, onOpenInspector }: { canvasId: string; tasks: Task[]; onOpenInspector: (task: Task) => void }) {
  const t = useT();
  const [views, setViews] = useState<SavedView[]>([]);
  const [active, setActive] = useState<SavedViewConfig>(defaults);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<SavedView | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { if (deleteCandidate) cancelDeleteRef.current?.focus(); }, [deleteCandidate]);
  useEffect(() => { void api.listSavedViews(canvasId).then(setViews).catch(() => setError(t("ledger.loadFailed"))); }, [canvasId, t]);
  const rows = useMemo(() => selectLedgerTasks(tasks, active), [tasks, active]);
  const tags = useMemo(() => [...new Set(tasks.flatMap((task) => task.tags))].sort((a, b) => a.localeCompare(b)), [tasks]);
  const change = (next: SavedViewConfig) => { setActive(next); setActiveViewId(null); };
  // groupKey sorts on stable raw values; only the display is translated.
  const groupLabel = (key: string) => key === "Untagged" ? t("ledger.untagged")
    : key === "Completed" ? t("ledger.status.done")
      : key === "Open" ? t("ledger.status.open")
        : key === "No due date" ? t("ledger.noDueDate")
          : ["high", "medium", "low"].includes(key) ? t(`b.priority.${key}`) : key;
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!name.trim()) return;
    try { const view = await api.createSavedView({ canvasId, name, config: active }); setViews((items) => [...items, view]); setName(""); setActiveViewId(view.id); setNotice(t("ledger.savedNotice", { name: view.name })); }
    catch { setError(t("ledger.createFailed")); }
  };
  const remove = async (view: SavedView) => {
    try { await api.deleteSavedView(view.id); setViews((items) => items.filter((item) => item.id !== view.id)); if (activeViewId === view.id) setActiveViewId(null); setNotice(t("ledger.deletedNotice", { name: view.name })); }
    catch { setError(t("ledger.deleteFailed")); }
    finally { setDeleteCandidate(null); requestAnimationFrame(() => deleteTriggerRef.current?.focus()); }
  };
  return <section aria-labelledby="ledger-heading" className="space-y-4 p-3">
    <div>
      <h2 id="ledger-heading" ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-nc-text">{t("ledger.title")}</h2>
      <p className="mt-1 text-xs text-nc-muted">{t("ledger.subtitle")}</p>
    </div>
    {error && <p role="alert" className="text-xs text-nc-danger">{error}</p>}<p role="status" aria-live="polite" className="sr-only">{notice}</p>
    <fieldset className="flex flex-wrap items-end gap-2" aria-describedby="ledger-filter-summary">
      <legend className="mb-2 text-2xs font-medium uppercase tracking-wider text-nc-muted">{t("ledger.filters")}</legend>
      <label className={labelCls}>{t("ledger.completion")} <Select value={active.done === undefined ? "all" : String(active.done)} onChange={(e) => change({ ...active, done: e.target.value === "all" ? undefined : e.target.value === "true" })}><option value="all">{t("ledger.completion.all")}</option><option value="false">{t("ledger.status.open")}</option><option value="true">{t("ledger.status.done")}</option></Select></label>
      <label className={labelCls}>{t("ledger.tag")} <Select value={active.tag ?? ""} onChange={(e) => change({ ...active, tag: e.target.value || undefined })}><option value="">{t("ledger.tag.all")}</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</Select></label>
      <label className={labelCls}>{t("ledger.priority")} <Select value={active.priority ?? ""} onChange={(e) => change({ ...active, priority: e.target.value || undefined })}><option value="">{t("ledger.priority.all")}</option><option value="high">{t("b.priority.high")}</option><option value="medium">{t("b.priority.medium")}</option><option value="low">{t("b.priority.low")}</option></Select></label>
      <label className={labelCls}>{t("ledger.group")} <Select value={active.group ?? "none"} onChange={(e) => change({ ...active, group: e.target.value as SavedViewConfig["group"] })}><option value="none">{t("ledger.group.none")}</option><option value="tag">{t("ledger.tag")}</option><option value="status">{t("ledger.column.status")}</option><option value="priority">{t("ledger.priority")}</option><option value="dueDate">{t("ledger.sort.dueDate")}</option></Select></label>
      <label className={labelCls}>{t("ledger.sort")} <Select value={active.sort} onChange={(e) => change({ ...active, sort: e.target.value as SavedViewConfig["sort"] })}><option value="dueDate">{t("ledger.sort.dueDate")}</option><option value="priority">{t("ledger.sort.priority")}</option><option value="title">{t("ledger.sort.title")}</option><option value="createdAt">{t("ledger.sort.createdAt")}</option></Select></label>
      <Button size="sm" onClick={() => change({ ...active, direction: active.direction === "asc" ? "desc" : "asc" })}>{active.direction === "asc" ? t("ledger.ascending") : t("ledger.descending")}</Button>
      <Button size="sm" onClick={() => change(defaults)}>{t("ledger.reset")}</Button>
    </fieldset>
    <p id="ledger-filter-summary" className="text-xs text-nc-muted">{t("ledger.summary", { count: rows.length, sort: t(`ledger.sort.${active.sort ?? "dueDate"}`), direction: active.direction === "desc" ? t("ledger.descending") : t("ledger.ascending") })}</p>
    <form onSubmit={(event) => void save(event)} className="flex flex-wrap items-center gap-2">
      <label htmlFor="ledger-name" className={labelCls}>{t("ledger.savedViewName")}</label>
      <Input id="ledger-name" className="min-w-48" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ledger.savePlaceholder")} maxLength={120}/>
      <Button type="submit" size="sm" disabled={!name.trim()}>{t("ledger.saveView")}</Button>
    </form>
    <div aria-label={t("ledger.savedViews")}>{views.length === 0 ? <p className="text-xs text-nc-muted">{t("ledger.noSavedViews")}</p> : <ul className="flex flex-wrap gap-1.5 m-0 p-0 list-none">{views.map((view) => <li key={view.id} className="inline-flex overflow-hidden rounded-nc-md border border-nc-line-faint"><button type="button" className={`px-2.5 py-1.5 text-xs transition-colors ${activeViewId === view.id ? "bg-nc-accent-muted text-nc-accent-strong" : "text-nc-soft hover:bg-nc-fill-faint hover:text-nc-text"}`} aria-current={activeViewId === view.id ? "page" : undefined} onClick={() => { setActive(view.config); setActiveViewId(view.id); setNotice(t("ledger.loadedNotice", { name: view.name, count: selectLedgerTasks(tasks, view.config).length })); }}>{view.name}</button><button ref={activeViewId === view.id ? deleteTriggerRef : undefined} type="button" className="border-l border-nc-line-faint px-2 text-xs text-nc-muted transition-colors hover:bg-nc-danger-muted hover:text-nc-danger" aria-label={t("ledger.deleteAria", { name: view.name })} onClick={(event) => { deleteTriggerRef.current = event.currentTarget; setDeleteCandidate(view); }}>×</button></li>)}</ul>}</div>
    <div tabIndex={0} aria-label={t("ledger.results")} className="overflow-auto rounded-nc-md border border-nc-line-faint">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{t("ledger.resultsCaption")}</caption>
        <thead className="border-b border-nc-line-faint text-2xs uppercase tracking-wider text-nc-muted">
          <tr>{active.group && active.group !== "none" && <th scope="col" className="px-3 py-2 font-medium">{t("ledger.column.group")}</th>}<th scope="col" className="px-3 py-2 font-medium">{t("ledger.column.task")}</th><th scope="col" className="px-3 py-2 font-medium">{t("ledger.column.status")}</th><th scope="col" className="px-3 py-2 font-medium">{t("ledger.column.priority")}</th><th scope="col" className="px-3 py-2 font-medium">{t("ledger.column.due")}</th></tr>
        </thead>
        <tbody>{rows.map((task) => <tr key={task.id} className="border-b border-nc-line-faint last:border-b-0 hover:bg-nc-fill-faint transition-colors">{active.group && active.group !== "none" && <td className="px-3 py-2 text-nc-muted">{groupLabel(groupKey(task, active.group))}</td>}<td className="px-3 py-2"><button type="button" aria-label={t("ledger.openTaskAria", { title: task.title || t("ledger.untitled"), priority: t(`b.priority.${task.priority}`) })} onClick={() => onOpenInspector(task)} className="text-left text-nc-text underline decoration-nc-line underline-offset-2 transition-colors hover:text-nc-accent hover:decoration-nc-accent">{task.title || t("ledger.untitled")}</button></td><td className="px-3 py-2 text-nc-muted">{task.done ? t("ledger.status.done") : t("ledger.status.open")}</td><td className="px-3 py-2 text-nc-muted">{t(`b.priority.${task.priority}`)}</td><td className="px-3 py-2 text-nc-muted">{localDateKey(task.dueDate) ?? t("ledger.noDueDate")}</td></tr>)}</tbody>
      </table>
      {rows.length === 0 && <p role="status" className="px-3 py-3 text-xs text-nc-muted">{t("ledger.empty")}</p>}
    </div>
    {deleteCandidate && <div role="alertdialog" aria-modal="true" aria-labelledby="delete-view-heading" aria-describedby="delete-view-description" onKeyDown={(event) => { if (event.key === "Escape") setDeleteCandidate(null); }} className="rounded-nc-md border border-nc-danger-border bg-nc-raised p-3">
      <h3 id="delete-view-heading" className="text-sm font-semibold text-nc-text">{t("ledger.deleteHeading")}</h3>
      <p id="delete-view-description" className="mt-1 text-xs text-nc-soft">{t("ledger.deleteDescription", { name: deleteCandidate.name })}</p>
      <div className="mt-3 flex gap-2">
        <Button ref={cancelDeleteRef} size="sm" onClick={() => { setDeleteCandidate(null); requestAnimationFrame(() => deleteTriggerRef.current?.focus()); }}>{t("ledger.cancel")}</Button>
        <Button variant="danger" size="sm" onClick={() => void remove(deleteCandidate)}>{t("ledger.deleteConfirm")}</Button>
      </div>
    </div>}
  </section>;
}
