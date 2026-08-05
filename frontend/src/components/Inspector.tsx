import { useEffect, useRef, useState } from "react";
import type { Dependency, Task, Workstream } from "../store";
import { dateLocale, useT } from "../i18n";
import { Chip } from "./ui/Chip";
import { workstreamsForTask } from "../data/workstreamSelectors";
import { selectWorkstreamHealth } from "../data/workstreamHealthSelectors";

interface InspectorFrameProps {
  title: string;
  onBack: () => void;
  backLabel?: string;
  children: React.ReactNode;
}

function InspectorFrame({ title, onBack, backLabel, children }: InspectorFrameProps) {
  const t = useT();
  return (
    <section aria-label={t("inspector.label")}>
      <div className="flex items-center justify-between gap-2 pr-9">
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-nc-muted">{title}</h2>
        <button
          type="button"
          onClick={onBack}
          className="rounded-nc-sm px-2 py-1 text-xs text-nc-muted transition-colors hover:bg-nc-fill-faint hover:text-nc-text"
        >
          {backLabel ?? t("inspector.back")}
        </button>
      </div>
      {children}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-medium uppercase tracking-wider text-nc-muted">{label}</dt>
      <dd className="mt-0.5 text-xs leading-5 text-nc-text">{children}</dd>
    </div>
  );
}

function providerName(provider: string): string {
  return provider.toLowerCase() === "github" ? "GitHub" : `${provider[0].toUpperCase()}${provider.slice(1)}`;
}

function healthReason(health: ReturnType<typeof selectWorkstreamHealth>, t: ReturnType<typeof useT>): string {
  const vars = {
    blocked: health.blockedCount,
    overdue: health.overdueCount,
    inbox: health.inboxCount,
    completed: health.completedCount,
    total: health.memberCount,
    missing: health.missingCount,
  };
  switch (health.status) {
    case "complete": return t("workstreams.health.short.complete", vars);
    case "blocked": return t("workstreams.health.short.blocked", vars);
    case "at-risk": return t("workstreams.health.short.atRisk", vars);
    case "needs-triage": return t(`workstreams.health.short.${health.primaryReason}`, vars);
    case "on-track": return t("workstreams.health.short.onTrack", vars);
  }
}

export function TaskInspector({
  task,
  tasks,
  workstreams,
  dependencies,
  onBack,
  backLabel,
  blockerEditor,
}: {
  task: Task;
  tasks: Task[];
  workstreams: Workstream[];
  dependencies: Dependency[];
  onBack: () => void;
  backLabel?: string;
  blockerEditor?: {
    enabled: boolean;
    onSetBlocker: (taskId: string, blockerId: string | null) => Promise<void>;
  };
}) {
  const t = useT();
  const memberships = workstreamsForTask(workstreams, task.id);
  const blockers = dependencies.filter((dependency) => dependency.blockedId === task.id);
  const blocking = dependencies.filter((dependency) => dependency.blockerId === task.id);
  const taskById = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  const checklistDone = task.checklist.filter((item) => item.done).length;
  const status = task.status ?? (task.done ? t("inspector.done") : t("inspector.open"));
  const source = task.provider ? `${providerName(task.provider)}${task.externalKey ? ` ${task.externalKey}` : ""}` : null;
  const currentBlocker = blockers[0] ? taskById.get(blockers[0].blockerId) : undefined;
  const activeCurrentBlocker = currentBlocker && !currentBlocker.done ? currentBlocker : undefined;
  const blockerV1Enabled = blockerEditor?.enabled === true;
  const candidates = tasks
    .filter((candidate) => candidate.canvasId === task.canvasId && candidate.id !== task.id && !candidate.done)
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const [selectedBlockerId, setSelectedBlockerId] = useState(currentBlocker?.id ?? "");
  const [blockerError, setBlockerError] = useState<string | null>(null);
  const [blockerNotice, setBlockerNotice] = useState<string | null>(null);
  const [savingBlocker, setSavingBlocker] = useState(false);
  const savingBlockerRef = useRef(false);

  useEffect(() => {
    setSelectedBlockerId(currentBlocker?.id ?? "");
  }, [task.id, currentBlocker?.id]);

  const saveBlocker = async (blockerId: string | null) => {
    if (!blockerV1Enabled || savingBlockerRef.current) return;
    savingBlockerRef.current = true;
    setSavingBlocker(true);
    setBlockerError(null);
    setBlockerNotice(null);
    try {
      await blockerEditor!.onSetBlocker(task.id, blockerId);
      setSelectedBlockerId(blockerId ?? "");
      setBlockerNotice(t(blockerId ? "inspector.blockerSaved" : "inspector.blockerCleared"));
    } catch {
      setBlockerError(t("inspector.blockerSaveFailed"));
    } finally {
      savingBlockerRef.current = false;
      setSavingBlocker(false);
    }
  };

  return (
    <InspectorFrame title={t("inspector.task")} onBack={onBack} backLabel={backLabel}>
      <div className="mt-3 space-y-4">
        <div>
          <h3 className="text-base font-semibold leading-snug text-nc-text [overflow-wrap:anywhere]">{task.title}</h3>
          <p className="mt-1.5"><Chip tone="accent">{status}</Chip></p>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
          <Detail label={t("inspector.nextAction")}>{task.description || t("inspector.none")}</Detail>
          <Detail label={t("inspector.workstreams")}>
            {memberships.length ? memberships.map((workstream) => workstream.name).join(", ") : t("inspector.none")}
          </Detail>
          <Detail label={t("inspector.due")}>
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString(dateLocale(), { dateStyle: "medium" }) : t("inspector.none")}
          </Detail>
          <Detail label={t("inspector.priority")}>{task.priority ? t(`inspector.priority.${task.priority}`) : t("inspector.none")}</Detail>
          <Detail label={t("inspector.tags")}>{task.tags.length ? task.tags.map((tag) => `#${tag}`).join(" ") : t("inspector.none")}</Detail>
          <Detail label={t("inspector.checklist")}>{t("inspector.checklistProgress", { done: checklistDone, total: task.checklist.length })}</Detail>
        </dl>
        {((blockerV1Enabled ? Boolean(activeCurrentBlocker) : blockers.length > 0) || blocking.length > 0) && (
          <dl className="space-y-2 border-t border-nc-line-faint pt-3">
            {(blockerV1Enabled ? activeCurrentBlocker : blockers.length > 0) && (
              <Detail label={t("inspector.blockedBy")}>
                {blockerV1Enabled
                  ? activeCurrentBlocker!.title
                  : blockers.map((dependency) => taskById.get(dependency.blockerId)?.title ?? dependency.blockerId).join(", ")}
              </Detail>
            )}
            {blocking.length > 0 && (
              <Detail label={t("inspector.blocks")}>
                {blocking.map((dependency) => taskById.get(dependency.blockedId)?.title ?? dependency.blockedId).join(", ")}
              </Detail>
            )}
          </dl>
        )}
        {blockerV1Enabled && (
          <section className="space-y-2 border-t border-nc-line-faint pt-3" aria-label={t("inspector.blockerControls")}>
            <label className="block text-2xs font-medium uppercase tracking-wider text-nc-muted" htmlFor={`blocker-${task.id}`}>{t("inspector.blocker")}</label>
            <div className="flex flex-wrap gap-2">
              <select id={`blocker-${task.id}`} value={selectedBlockerId} disabled={savingBlocker} onChange={(event) => setSelectedBlockerId(event.target.value)} className="min-w-0 flex-1 rounded-nc-sm border border-nc-line bg-nc-surface px-2 py-1 text-xs text-nc-text disabled:opacity-60 disabled:cursor-not-allowed">
                <option value="">{t("inspector.selectBlocker")}</option>
                {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
              </select>
              <button type="button" disabled={savingBlocker || !selectedBlockerId} onClick={() => void saveBlocker(selectedBlockerId)} className="rounded-nc-sm border border-nc-line px-2 py-1 text-xs text-nc-accent-strong disabled:opacity-60 disabled:cursor-not-allowed">
                {currentBlocker ? t("inspector.replaceBlocker") : t("inspector.setBlocker")}
              </button>
              {currentBlocker && <button type="button" disabled={savingBlocker} onClick={() => void saveBlocker(null)} className="rounded-nc-sm border border-nc-line px-2 py-1 text-xs text-nc-text disabled:opacity-60 disabled:cursor-not-allowed">{t("inspector.clearBlocker")}</button>}
            </div>
            {savingBlocker && <p role="status" aria-live="polite" className="text-xs text-nc-accent-strong">{t("inspector.savingBlocker")}</p>}
            {blockerNotice && <p role="status" aria-live="polite" className="text-xs text-nc-accent-strong">{blockerNotice}</p>}
            {blockerError && <p role="alert" className="text-xs text-nc-danger">{blockerError}</p>}
          </section>
        )}
        {(task.provider || task.lastActivityAt) && (
          <dl className="space-y-2 border-t border-nc-line-faint pt-3">
            {task.provider && (
              <Detail label={t("inspector.source")}>
                {task.externalUrl ? <a className="text-nc-accent-strong underline" href={task.externalUrl}>{source}</a> : source}
              </Detail>
            )}
            {task.syncedAt && <Detail label={t("inspector.synced")}>{new Date(task.syncedAt).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" })}</Detail>}
            {task.lastActivityAt && <Detail label={t("inspector.activity")}>{new Date(task.lastActivityAt).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" })}</Detail>}
          </dl>
        )}
      </div>
    </InspectorFrame>
  );
}

export function WorkstreamInspector({
  workstream,
  tasks,
  dependencies,
  now,
  onBack,
  onOpenTask,
  onOpenToday,
  onOpenReview,
}: {
  workstream: Workstream;
  tasks: Task[];
  dependencies: Dependency[];
  now?: Date;
  onBack: () => void;
  onOpenTask: (task: Task) => void;
  onOpenToday: () => void;
  onOpenReview: () => void;
}) {
  const t = useT();
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const members = workstream.memberships.map((membership) => taskById.get(membership.taskId)).filter((task): task is Task => Boolean(task));
  const health = selectWorkstreamHealth({ workstream, tasks, dependencies, now });
  const memberCountKey = health.memberCount === 0
    ? "inspector.memberCount.zero"
    : health.memberCount === 1
      ? "inspector.memberCount.one"
      : "inspector.memberCount.many";

  return (
    <InspectorFrame title={t("inspector.workstream")} onBack={onBack}>
      <div className="mt-3 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-nc-text">{workstream.name}</h3>
          {workstream.description && <p className="mt-1 text-xs leading-5 text-nc-soft">{workstream.description}</p>}
          <div className="mt-2 flex flex-wrap gap-1 text-2xs">
            {workstream.pinned && <span className="rounded-nc-sm bg-nc-fill-faint px-1 text-nc-soft">{t("workstreams.pinned")}</span>}
            {workstream.protected && <span className="rounded-nc-sm bg-nc-fill-faint px-1 text-nc-soft">{t("workstreams.protected")}</span>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
          <Detail label={t("inspector.members")}>{t(memberCountKey, { count: health.memberCount })}</Detail>
          <Detail label={t("inspector.progress")}>{t("inspector.checklistProgress", { done: health.completedCount, total: health.memberCount })}</Detail>
          <Detail label={t("inspector.health")}>
            <span data-workstream-health={health.status}>{t(`workstreams.health.${health.status}`)}</span>
            <span className="block text-nc-muted">{healthReason(health, t)}</span>
          </Detail>
        </dl>
        <div className="border-t border-nc-line-faint pt-3">
          <h4 className="text-2xs font-medium uppercase tracking-wider text-nc-muted">{t("workstreams.members")}</h4>
          <ul className="mt-1 space-y-1" aria-label={t("workstreams.members")}>
            {members.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-2 text-xs text-nc-text">
                <span className="truncate">{task.title}</span>
                <button type="button" onClick={() => onOpenTask(task)} className="shrink-0 rounded-nc-sm px-1 text-nc-accent-strong hover:bg-nc-accent-muted">{t("inspector.openTask")}</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-nc-line-faint pt-3">
          <button type="button" onClick={onOpenToday} className="rounded-nc-sm px-2 py-1 text-xs text-nc-accent-strong hover:bg-nc-accent-muted">{t("inspector.openToday")}</button>
          <button type="button" onClick={onOpenReview} className="rounded-nc-sm px-2 py-1 text-xs text-nc-accent-strong hover:bg-nc-accent-muted">{t("inspector.openReview")}</button>
        </div>
      </div>
    </InspectorFrame>
  );
}
