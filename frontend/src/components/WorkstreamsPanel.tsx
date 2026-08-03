import { useEffect, useState } from "react";
import type { Dependency, Task, Workstream } from "../data/api";
import { workstreamTaskCount } from "../data/workstreamSelectors";
import { selectWorkstreamHealth, type WorkstreamHealth } from "../data/workstreamHealthSelectors";
import { previewArrangementOperation, type ArrangementPreview, type SkippedArrangementEntity } from "../engine/arrangementOperation";
import type { ArrangementStrategy } from "../engine/arrangementOperation";
import { useT } from "../i18n";

interface WorkstreamsPanelProps {
  workstreams: Workstream[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onUpdate: (id: string, patch: { name?: string; pinned?: boolean; protected?: boolean }) => void;
  onDelete: (id: string) => void;
  tasks: Task[];
  dependencies: Dependency[];
  now?: Date;
  onSetMembership: (workstreamId: string, taskId: string, member: boolean) => void;
  onApplyArrangement: (preview: ArrangementPreview) => Promise<boolean>;
}

function healthReason(health: WorkstreamHealth, t: ReturnType<typeof useT>): string {
  const vars = { blocked: health.blockedCount, overdue: health.overdueCount, inbox: health.inboxCount, completed: health.completedCount, total: health.memberCount, missing: health.missingCount };
  switch (health.status) {
    case "complete": return t("workstreams.health.short.complete", vars);
    case "blocked": return t("workstreams.health.short.blocked", vars);
    case "at-risk": return t("workstreams.health.short.atRisk", vars);
    case "needs-triage": return t(`workstreams.health.short.${health.primaryReason}`, vars);
    case "on-track": return t("workstreams.health.short.onTrack", vars);
  }
}

function arrangementSkipReason(reason: SkippedArrangementEntity["reason"], t: ReturnType<typeof useT>): string {
  return t(`workstreams.arrangementReason.${reason}`);
}

export function WorkstreamArrangementPreview({
  preview,
  onApply,
  onCancel,
}: {
  preview: ArrangementPreview;
  onApply: () => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="space-y-2" aria-live="polite">
      <p className="text-xs text-cyan-100">
        {preview.isNoop
          ? t("workstreams.arrangementNoop")
          : t("workstreams.arrangementPreview", { moved: preview.moved.length, skipped: preview.skipped.length })}
        {` ${t("workstreams.arrangementUnchanged", { count: preview.unchanged.length })}`}
      </p>
      {preview.skipped.length > 0 && <ul className="text-xs text-gray-300" aria-label={t("workstreams.arrangementSkipped")}>{preview.skipped.map((item) => <li key={`${item.id}-${item.reason}`}>{item.id}: {arrangementSkipReason(item.reason, t)}</li>)}</ul>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={preview.isNoop}
          onClick={onApply}
          className="rounded bg-cyan-400/15 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("workstreams.applyArrangement")}
        </button>
        <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          {t("workstreams.cancelArrangement")}
        </button>
      </div>
    </div>
  );
}

/** Structured, non-canvas navigation for durable manual workstreams. */
export function WorkstreamsPanel({
  workstreams,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  tasks,
  dependencies,
  now,
  onSetMembership,
  onApplyArrangement,
}: WorkstreamsPanelProps) {
  const t = useT();
  const [name, setName] = useState("");
  const selected = workstreams.find((workstream) => workstream.id === selectedId) ?? null;
  const [selectedName, setSelectedName] = useState("");
  const [arrangementPreview, setArrangementPreview] = useState<ArrangementPreview | null>(null);
  const [arrangeStrategy, setArrangeStrategy] = useState<ArrangementStrategy>("tidy-overlaps");
  const [canvasPreview, setCanvasPreview] = useState<ArrangementPreview | null>(null);

  useEffect(() => {
    setSelectedName(selected?.name ?? "");
    setArrangementPreview(null);
  }, [selected?.id, selected?.name]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName("");
  };

  const submitSelected = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = selectedName.trim();
    if (selected && trimmed && trimmed !== selected.name) onUpdate(selected.id, { name: trimmed });
  };

  return (
    <section className="border-t border-white/10 pt-4 mt-4" aria-labelledby="workstreams-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="workstreams-heading" className="text-xs font-semibold uppercase tracking-wider text-cyan-200">
          {t("workstreams.title")}
        </h2>
        <span className="text-[10px] text-gray-400">{t("workstreams.durable")}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-gray-400">{t("workstreams.suggestionsNotice")}</p>
      <ul className="mt-3 space-y-1" aria-label={t("workstreams.listLabel")}>
        {workstreams.map((workstream) => {
          const count = workstreamTaskCount(workstream);
          const health = selectWorkstreamHealth({ workstream, tasks, dependencies, now });
          const selected = selectedId === workstream.id;
          return (
            <li key={workstream.id}>
              <button
                type="button"
                className={`w-full rounded px-2 py-2 text-left text-sm transition ${selected ? "bg-cyan-400/15 text-cyan-100" : "text-gray-200 hover:bg-white/5"}`}
                aria-pressed={selected}
                onClick={() => onSelect(workstream.id)}
              >
                <span className="block truncate font-medium">{workstream.name}</span>
                <span className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-400">
                  <span>{t("workstreams.taskCount", { count })}</span>
                  <span data-workstream-health={health.status} className="rounded bg-white/5 px-1 text-gray-200">{t(`workstreams.health.${health.status}`)}</span>
                  {workstream.pinned && <span className="rounded bg-amber-300/10 px-1 text-amber-200">{t("workstreams.pinned")}</span>}
                  {workstream.protected && <span className="rounded bg-violet-300/10 px-1 text-violet-200">{t("workstreams.protected")}</span>}
                </span>
                <span className="mt-1 block text-[11px] text-gray-400">{healthReason(health, t)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected && (
        <div className="mt-3 rounded border border-white/10 bg-black/10 p-2">
          <form className="flex gap-2" onSubmit={submitSelected}>
            <label className="sr-only" htmlFor="selected-workstream-name">{t("workstreams.name")}</label>
            <input
              id="selected-workstream-name"
              value={selectedName}
              maxLength={120}
              onChange={(event) => setSelectedName(event.target.value)}
              className="min-w-0 flex-1 rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white focus:border-cyan-300 focus:outline-none"
            />
            <button type="submit" className="rounded px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/15">{t("workstreams.save")}</button>
          </form>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => onUpdate(selected.id, { pinned: !selected.pinned })} className="text-xs text-gray-300 hover:text-white">
              {selected.pinned ? t("workstreams.unpin") : t("workstreams.pin")}
            </button>
            <button type="button" onClick={() => onDelete(selected.id)} disabled={selected.protected} className="text-xs text-red-300 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50">
              {t("workstreams.delete")}
            </button>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              role="switch"
              checked={selected.protected}
              onChange={() => onUpdate(selected.id, { protected: !selected.protected })}
            />
            <span>{t("workstreams.protected")}</span>
          </label>
          {selected.protected && <p className="mt-1 text-xs text-violet-200">{t("workstreams.unprotectBeforeDelete")}</p>}
          <div className="mt-3 border-t border-white/10 pt-2">
            <label className="block text-xs text-gray-300" htmlFor="workstream-arrange-mode">{t("workstreams.arrangeBy")} <select id="workstream-arrange-mode" value={arrangeStrategy} onChange={(event) => setArrangeStrategy(event.target.value as ArrangementStrategy)}><option value="tidy-overlaps">{t("workstreams.strategy.tidy")}</option><option value="grid">{t("workstreams.strategy.grid")}</option><option value="tag">{t("workstreams.strategy.tag")}</option><option value="status">{t("workstreams.strategy.status")}</option><option value="priority">{t("workstreams.strategy.priority")}</option><option value="due">{t("workstreams.strategy.due")}</option></select></label>
            {selected.pinned || selected.protected ? (
              <p className="text-xs text-gray-400">{t("workstreams.arrangementProtected")}</p>
            ) : arrangementPreview ? (
              <WorkstreamArrangementPreview
                preview={arrangementPreview}
                onApply={async () => {
                  if (await onApplyArrangement(arrangementPreview)) setArrangementPreview(null);
                }}
                onCancel={() => setArrangementPreview(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setArrangementPreview(previewArrangementOperation({
                  scope: {
                    kind: "workstream",
                    workstreamId: selected.id,
                    taskIds: selected.memberships.map((membership) => membership.taskId),
                  },
                  strategy: arrangeStrategy,
                  tasks,
                  workstreams: workstreams.map((workstream) => ({
                    id: workstream.id,
                    pinned: workstream.pinned,
                    protected: workstream.protected,
                    taskIds: workstream.memberships.map((membership) => membership.taskId),
                  })),
                }))}
                className="rounded px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/15"
              >
                {t("workstreams.arrange")}
              </button>
            )}
          </div>
          <fieldset className="mt-3 border-t border-white/10 pt-2">
            <legend className="text-xs font-medium text-gray-300">{t("workstreams.members")}</legend>
            {tasks.map((task) => {
              const member = selected.memberships.some((membership) => membership.taskId === task.id);
              return (
                <label key={task.id} className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-gray-300">
                  <input type="checkbox" checked={member} onChange={() => onSetMembership(selected.id, task.id, !member)} />
                  <span className="truncate">{task.title}</span>
                </label>
              );
            })}
          </fieldset>
        </div>
      )}
      <div className="mt-3 border-t border-white/10 pt-2" aria-label={t("workstreams.boardArrangement")}>
        {canvasPreview ? (
          <WorkstreamArrangementPreview preview={canvasPreview} onApply={async () => { if (await onApplyArrangement(canvasPreview)) setCanvasPreview(null); }} onCancel={() => setCanvasPreview(null)} />
        ) : (
          <button type="button" onClick={() => setCanvasPreview(previewArrangementOperation({
            scope: { kind: "canvas", taskIds: tasks.map((task) => task.id) }, strategy: arrangeStrategy, tasks,
            workstreams: workstreams.map((workstream) => ({ id: workstream.id, pinned: workstream.pinned, protected: workstream.protected, taskIds: workstream.memberships.map((membership) => membership.taskId) })),
          }))} className="rounded px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/15">{t("workstreams.previewBoardArrangement")}</button>
        )}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={submit}>
        <label className="sr-only" htmlFor="new-workstream-name">{t("workstreams.newName")}</label>
        <input
          id="new-workstream-name"
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("workstreams.newName")}
          className="min-w-0 flex-1 rounded border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-white placeholder:text-gray-500 focus:border-cyan-300 focus:outline-none"
        />
        <button type="submit" className="rounded bg-cyan-400/15 px-2 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-400/25">
          {t("workstreams.create")}
        </button>
      </form>
    </section>
  );
}
