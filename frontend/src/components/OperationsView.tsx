import type { Dependency, Task, Workstream } from "../data/api";
import { selectOperationsWorkstreams } from "../data/operationsSelectors";
import { selectWorkstreamHealth, type WorkstreamHealth } from "../data/workstreamHealthSelectors";
import { localDayKey } from "../utils/capacity";
import { useT } from "../i18n";

interface OperationsViewProps {
  tasks: Task[];
  workstreams: Workstream[];
  dependencies: Dependency[];
  now?: Date;
  onOpenInspector: (task: Task) => void;
  onReveal: (task: Task) => void;
}

function healthReason(health: WorkstreamHealth, t: ReturnType<typeof useT>): string {
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

/** Read-only local projection of active tasks, grouped by canonical workstream. */
export function OperationsView({ tasks, workstreams, dependencies, now = new Date(), onOpenInspector, onReveal }: OperationsViewProps) {
  const t = useT();
  const groups = selectOperationsWorkstreams({ tasks, workstreams });
  const workstreamById = new Map(workstreams.map((workstream) => [workstream.id, workstream]));
  const today = localDayKey(now);

  return (
    <section data-operations-view="local-derived" aria-label={t("operations.label")} className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-200">{t("operations.title")}</h2>
      {groups.length === 0 ? (
        <p className="text-xs text-gray-400">{t("operations.empty")}</p>
      ) : groups.map((group) => {
        const workstream = workstreamById.get(group.id);
        const health = workstream ? selectWorkstreamHealth({ workstream, tasks, dependencies, now }) : null;
        return (
          <section key={group.id} aria-label={group.name} className="rounded border border-white/10 bg-black/10 p-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <h3 className="text-xs font-medium text-cyan-100">{group.name}</h3>
              {health && <span data-workstream-open-count={health.openCount} className="text-[10px] text-gray-400">{health.openCount} open</span>}
            </div>
            {health && (
              <p data-workstream-health={health.status} data-workstream-health-reason={health.primaryReason} className="mt-1 text-[10px] text-gray-400">
                <span className="text-gray-200">{t(`workstreams.health.${health.status}`)}</span>
                <span> · {healthReason(health, t)}</span>
              </p>
            )}
            <ul className="mt-1 space-y-1">
              {group.tasks.map((task) => {
                const dueToday = task.dueDate !== null && localDayKey(task.dueDate) === today;
                return (
                  <li key={task.id} className="flex items-center justify-between gap-2 text-xs text-gray-200">
                    <span className="min-w-0 truncate">{task.title}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span data-task-priority={task.priority} className="rounded bg-white/5 px-1 text-[10px] text-gray-300">{t(`inspector.priority.${task.priority}`)}</span>
                      {dueToday && <span data-task-today="true" className="rounded bg-cyan-400/10 px-1 text-[10px] text-cyan-100">{t("today.today")}</span>}
                      <button type="button" onClick={() => onOpenInspector(task)} data-mobile-inspector-task={task.id} className="rounded border border-white/15 px-2 py-1 text-[10px] text-gray-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                        {t("operations.openInspector")}
                      </button>
                      <button type="button" onClick={() => onReveal(task)} className="rounded border border-white/15 px-2 py-1 text-[10px] text-gray-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                        {t("operations.reveal")}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
