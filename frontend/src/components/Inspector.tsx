import type { Dependency, Task, Workstream } from "../store";
import { dateLocale, useT } from "../i18n";
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
    <section className="border-t border-white/10 pt-4 mt-4" aria-label={t("inspector.label")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-200">{title}</h2>
        <button
          type="button"
          onClick={onBack}
          className="rounded px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
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
      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-xs leading-5 text-gray-200">{children}</dd>
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
}: {
  task: Task;
  tasks: Task[];
  workstreams: Workstream[];
  dependencies: Dependency[];
  onBack: () => void;
  backLabel?: string;
}) {
  const t = useT();
  const memberships = workstreamsForTask(workstreams, task.id);
  const blockers = dependencies.filter((dependency) => dependency.blockedId === task.id);
  const blocking = dependencies.filter((dependency) => dependency.blockerId === task.id);
  const taskById = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  const checklistDone = task.checklist.filter((item) => item.done).length;
  const status = task.status ?? (task.done ? t("inspector.done") : t("inspector.open"));
  const source = task.provider ? `${providerName(task.provider)}${task.externalKey ? ` ${task.externalKey}` : ""}` : null;

  return (
    <InspectorFrame title={t("inspector.task")} onBack={onBack} backLabel={backLabel}>
      <div className="mt-3 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{task.title}</h3>
          <p className="mt-1 text-xs text-cyan-100">{status}</p>
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
        {(blockers.length > 0 || blocking.length > 0) && (
          <dl className="space-y-2 border-t border-white/10 pt-3">
            {blockers.length > 0 && (
              <Detail label={t("inspector.blockedBy")}>
                {blockers.map((dependency) => taskById.get(dependency.blockerId)?.title ?? dependency.blockerId).join(", ")}
              </Detail>
            )}
            {blocking.length > 0 && (
              <Detail label={t("inspector.blocks")}>
                {blocking.map((dependency) => taskById.get(dependency.blockedId)?.title ?? dependency.blockedId).join(", ")}
              </Detail>
            )}
          </dl>
        )}
        {(task.provider || task.lastActivityAt) && (
          <dl className="space-y-2 border-t border-white/10 pt-3">
            {task.provider && (
              <Detail label={t("inspector.source")}>
                {task.externalUrl ? <a className="text-cyan-200 underline" href={task.externalUrl}>{source}</a> : source}
              </Detail>
            )}
            {task.syncedAt && <Detail label={t("inspector.synced")}>{new Date(task.syncedAt).toLocaleString(dateLocale())}</Detail>}
            {task.lastActivityAt && <Detail label={t("inspector.activity")}>{new Date(task.lastActivityAt).toLocaleString(dateLocale())}</Detail>}
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
          <h3 className="text-sm font-semibold text-white">{workstream.name}</h3>
          {workstream.description && <p className="mt-1 text-xs leading-5 text-gray-300">{workstream.description}</p>}
          <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
            {workstream.pinned && <span className="rounded bg-amber-300/10 px-1 text-amber-200">{t("workstreams.pinned")}</span>}
            {workstream.protected && <span className="rounded bg-violet-300/10 px-1 text-violet-200">{t("workstreams.protected")}</span>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
          <Detail label={t("inspector.members")}>{t(memberCountKey, { count: health.memberCount })}</Detail>
          <Detail label={t("inspector.progress")}>{t("inspector.checklistProgress", { done: health.completedCount, total: health.memberCount })}</Detail>
          <Detail label={t("inspector.health")}>
            <span data-workstream-health={health.status}>{t(`workstreams.health.${health.status}`)}</span>
            <span className="block text-gray-400">{healthReason(health, t)}</span>
          </Detail>
        </dl>
        <div className="border-t border-white/10 pt-3">
          <h4 className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{t("workstreams.members")}</h4>
          <ul className="mt-1 space-y-1" aria-label={t("workstreams.members")}>
            {members.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-2 text-xs text-gray-200">
                <span className="truncate">{task.title}</span>
                <button type="button" onClick={() => onOpenTask(task)} className="shrink-0 rounded px-1 text-cyan-100 hover:bg-cyan-400/15">{t("inspector.openTask")}</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
          <button type="button" onClick={onOpenToday} className="rounded px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/15">{t("inspector.openToday")}</button>
          <button type="button" onClick={onOpenReview} className="rounded px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/15">{t("inspector.openReview")}</button>
        </div>
      </div>
    </InspectorFrame>
  );
}
