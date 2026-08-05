import type { Dependency, Task, Workstream } from "../data/api";
import { selectOperationsWorkstreams } from "../data/operationsSelectors";
import { selectWorkstreamHealth, type WorkstreamHealth } from "../data/workstreamHealthSelectors";
import { localDayKey } from "../utils/capacity";
import { useT } from "../i18n";
import { NightCartographyRowAction, NightCartographyTaskRow } from "./NightCartography";

interface OperationsViewProps {
  tasks: Task[];
  workstreams: Workstream[];
  dependencies: Dependency[];
  now?: Date;
  onOpenInspector: (task: Task) => void;
  onReveal: (task: Task) => void;
  /** The mobile companion guarantees 44px action targets. */
  mobile?: boolean;
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
export function OperationsView({ tasks, workstreams, dependencies, now = new Date(), onOpenInspector, onReveal, mobile = false }: OperationsViewProps) {
  const t = useT();
  const groups = selectOperationsWorkstreams({ tasks, workstreams });
  const workstreamById = new Map(workstreams.map((workstream) => [workstream.id, workstream]));
  const today = localDayKey(now);

  return (
    <section data-operations-view="local-derived" aria-label={t("operations.label")} className={`space-y-3${mobile ? " mobile-operations" : ""}`}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-nc-accent-strong">{t("operations.title")}</h2>
      {groups.length === 0 ? (
        <p className="text-xs text-nc-muted">{t("operations.empty")}</p>
      ) : groups.map((group) => {
        const workstream = workstreamById.get(group.id);
        const health = workstream ? selectWorkstreamHealth({ workstream, tasks, dependencies, now }) : null;
        return (
          <section key={group.id} aria-label={group.name} className="rounded-nc-md border border-nc-line-faint bg-nc-canvas/30 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <h3 className="text-sm font-medium text-nc-accent-strong">{group.id === "unassigned" ? t("operations.unassigned") : group.name}</h3>
              {health && <span data-workstream-open-count={health.openCount} className="text-xs text-nc-muted">{t("operations.openCount", { count: health.openCount })}</span>}
            </div>
            {health && (
              <p data-workstream-health={health.status} data-workstream-health-reason={health.primaryReason} className="mt-1 text-xs text-nc-muted">
                <span className="text-nc-text">{t(`workstreams.health.${health.status}`)}</span>
                <span> · {healthReason(health, t)}</span>
              </p>
            )}
            <ul className="mt-2 space-y-2">
              {group.tasks.map((task) => {
                const dueToday = task.dueDate !== null && localDayKey(task.dueDate) === today;
                return (
                  <NightCartographyTaskRow
                    key={task.id}
                    title={task.title}
                    className={mobile ? "mobile-operations__task" : ""}
                    actionsClassName={mobile ? "mobile-operations__actions" : ""}
                    meta={<>
                      <span data-task-priority={task.priority} className="rounded-nc-sm bg-nc-fill-faint px-1.5 py-0.5 text-nc-soft">{t(`inspector.priority.${task.priority}`)}</span>
                      {dueToday && <span data-task-today="true" className="rounded-nc-sm bg-nc-accent-muted px-1.5 py-0.5 text-nc-accent-strong">{t("today.today")}</span>}
                    </>}
                    actions={<>
                      <NightCartographyRowAction label={t("operations.openInspector")} onClick={() => onOpenInspector(task)} inspectorTaskId={task.id} />
                      <NightCartographyRowAction label={t("operations.reveal")} onClick={() => onReveal(task)} />
                    </>}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
