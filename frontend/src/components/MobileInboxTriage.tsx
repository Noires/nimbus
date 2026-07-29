import { useState } from "react";
import type { Task, Workstream } from "../store";
import type { TaskPatch } from "../data/api";
import { dateLocale, useT } from "../i18n";
import type { InboxTriageState } from "./InboxTriage";

interface MobileInboxTriageProps {
  tasks: Task[];
  workstreams: Workstream[];
  state: InboxTriageState;
  onClearInbox: (task: Task) => Promise<void>;
  onSetWorkstream: (taskId: string, workstreamId: string) => Promise<void>;
  onPatchTask: (taskId: string, patch: TaskPatch) => Promise<void>;
  onOpenInspector: (task: Task) => void;
}

export async function runMobileInboxAction(action: () => Promise<void>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch {
    return false;
  }
}

function formatDueDate(dueDate: string | null): string {
  return dueDate
    ? new Date(dueDate).toLocaleDateString(dateLocale(), { dateStyle: "medium" })
    : "—";
}

export function MobileInboxTriage({
  tasks,
  workstreams,
  state,
  onClearInbox,
  onSetWorkstream,
  onPatchTask,
  onOpenInspector,
}: MobileInboxTriageProps) {
  const t = useT();
  const [actionError, setActionError] = useState<string | null>(null);
  const inboxTasks = tasks.filter((task) => task.inbox && !task.archivedAt);

  const run = (action: () => Promise<void>) => {
    setActionError(null);
    void runMobileInboxAction(action).then((succeeded) => {
      if (!succeeded) setActionError(t("inbox.triage.actionFailed"));
    });
  };

  if (state === "loading") {
    return <p className="mobile-inbox-triage__status">{t("inbox.triage.loading")}</p>;
  }

  if (state === "error") {
    return <p role="alert" className="mobile-inbox-triage__status">{t("inbox.triage.error")}</p>;
  }

  return (
    <section className="mobile-inbox-triage" aria-label={t("inbox.triage.label")}>
      {actionError && <p role="alert" className="mobile-inbox-triage__error">{actionError}</p>}
      {inboxTasks.length === 0 ? (
        <p className="mobile-inbox-triage__status">{t("inbox.triage.empty")}</p>
      ) : (
        <ul className="mobile-inbox-triage__list" aria-label={t("inbox.triage.tableLabel")}>
          {inboxTasks.map((task) => (
            <li key={task.id} className="mobile-inbox-triage__card">
              <div>
                <h2 className="mobile-inbox-triage__title">{task.title}</h2>
                <p className="mobile-inbox-triage__metadata">
                  {t(`inspector.priority.${task.priority}`)} · {formatDueDate(task.dueDate)}
                </p>
              </div>
              <div className="mobile-inbox-triage__controls">
                <label>
                  <span className="sr-only">{t("inbox.triage.priority")}</span>
                  <select
                    aria-label={t("inbox.triage.priority")}
                    value={task.priority}
                    onChange={(event) => run(() => onPatchTask(task.id, { priority: event.target.value }))}
                  >
                    <option value="high">{t("inspector.priority.high")}</option>
                    <option value="medium">{t("inspector.priority.medium")}</option>
                    <option value="low">{t("inspector.priority.low")}</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">{t("inbox.triage.workstream")}</span>
                  <select
                    aria-label={t("inbox.triage.workstream")}
                    defaultValue=""
                    onChange={(event) => {
                      if (event.target.value) run(() => onSetWorkstream(task.id, event.target.value));
                    }}
                  >
                    <option value="">{t("inbox.triage.chooseWorkstream")}</option>
                    {workstreams.map((workstream) => (
                      <option key={workstream.id} value={workstream.id}>{workstream.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mobile-inbox-triage__actions">
                <button type="button" onClick={() => run(() => onClearInbox(task))}>
                  {t("inbox.triage.clearInbox")}
                </button>
                <button type="button" onClick={() => onOpenInspector(task)} data-mobile-inspector-task={task.id}>
                  {t("inbox.triage.openInspector")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
