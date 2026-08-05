import { useEffect, useRef, useState } from "react";
import type { Task, Workstream } from "../store";
import type { TaskPatch } from "../data/api";
import { dateLocale, useT } from "../i18n";

export type InboxTriageState = "loading" | "error" | "ready";

interface InboxTriageProps {
  tasks: Task[];
  workstreams: Workstream[];
  state: InboxTriageState;
  focusNonce?: number;
  onCapture: (title: string) => Promise<void>;
  onClearInbox: (task: Task) => Promise<void>;
  onSetWorkstream: (taskId: string, workstreamId: string) => Promise<void>;
  onPatchTask: (taskId: string, patch: TaskPatch) => Promise<void>;
  onReveal: (task: Task) => void;
}

function formatDueDate(dueDate: string | null): string {
  return dueDate
    ? new Date(dueDate).toLocaleDateString(dateLocale(), { dateStyle: "medium" })
    : "—";
}

export function InboxTriage({
  tasks,
  workstreams,
  state,
  focusNonce = 0,
  onCapture,
  onClearInbox,
  onSetWorkstream,
  onPatchTask,
  onReveal,
}: InboxTriageProps) {
  const t = useT();
  const [captureText, setCaptureText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inboxTasks = tasks.filter((task) => task.inbox && !task.archivedAt);

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusNonce]);

  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setActionError(null);
    try {
      await action();
      return true;
    } catch {
      setActionError(t("inbox.triage.actionFailed"));
      return false;
    }
  };

  const capture = () => {
    const submittedText = captureText;
    const title = submittedText.trim();
    if (!title) return;
    void run(() => onCapture(title)).then((succeeded) => {
      if (succeeded) setCaptureText((current) => (current === submittedText ? "" : current));
    });
  };

  return (
    <section className="p-4" aria-label={t("inbox.triage.label")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-nc-accent-strong">{t("inbox.triage.title")}</h2>
          <p className="mt-1 text-xs leading-5 text-nc-muted">{t("inbox.triage.subtitle")}</p>
        </div>
        <span className="rounded-full bg-nc-fill px-2 py-1 text-xs text-nc-muted">{inboxTasks.length}</span>
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          capture();
        }}
      >
        <label className="sr-only" htmlFor="inbox-triage-capture">{t("inbox.triage.captureLabel")}</label>
        <input
          ref={inputRef}
          id="inbox-triage-capture"
          value={captureText}
          onChange={(event) => setCaptureText(event.target.value)}
          placeholder={t("inbox.triage.capturePlaceholder")}
          className="min-w-0 flex-1 rounded-nc-md border border-nc-line-faint bg-nc-well/60 px-2.5 py-2 text-xs transition-colors"
        />
        <button type="submit" className="rounded-nc-md bg-nc-select/10 px-3 py-2 text-xs text-nc-select hover:bg-nc-select-surface/30">
          {t("inbox.triage.capture")}
        </button>
      </form>
      {actionError && <p role="alert" className="mt-2 text-xs text-nc-danger">{actionError}</p>}

      <div className="mt-4 overflow-x-auto">
        {state === "loading" ? (
          <p className="text-xs text-nc-faint">{t("inbox.triage.loading")}</p>
        ) : state === "error" ? (
          <p role="alert" className="text-xs text-nc-danger">{t("inbox.triage.error")}</p>
        ) : inboxTasks.length === 0 ? (
          <p className="text-xs leading-5 text-nc-faint">{t("inbox.triage.empty")}</p>
        ) : (
          <table className="w-full min-w-[38rem] text-left text-xs" aria-label={t("inbox.triage.tableLabel")}>
            <thead className="border-b border-nc-line-faint text-2xs uppercase tracking-wider text-nc-muted">
              <tr>
                <th className="px-2 py-2 font-medium">{t("inbox.triage.task")}</th>
                <th className="px-2 py-2 font-medium">{t("inbox.triage.priority")}</th>
                <th className="px-2 py-2 font-medium">{t("inbox.triage.due")}</th>
                <th className="px-2 py-2 font-medium">{t("inbox.triage.workstream")}</th>
                <th className="px-2 py-2 font-medium"><span className="sr-only">{t("inbox.triage.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {inboxTasks.map((task) => (
                <tr key={task.id} className="night-cartography__task-row border-b border-nc-line-faint align-top">
                  <td className="w-full min-w-48 px-2 py-3 text-nc-text">
                    <div className="text-sm font-medium [overflow-wrap:anywhere]">{task.title}</div>
                    <div className="mt-1 text-xs text-nc-faint [overflow-wrap:anywhere]">{task.tags.map((tag) => `#${tag}`).join(" ") || t("inbox.triage.noTags")}</div>
                  </td>
                  <td className="px-2 py-3">
                    <label className="sr-only" htmlFor={`inbox-priority-${task.id}`}>{t("inbox.triage.priority")}</label>
                    <select
                      id={`inbox-priority-${task.id}`}
                      value={task.priority}
                      onChange={(event) => { void run(() => onPatchTask(task.id, { priority: event.target.value })); }}
                      className="rounded-nc-sm border border-nc-line-faint bg-nc-well/60 px-1.5 py-1 text-xs text-nc-text"
                    >
                      <option value="high">{t("inspector.priority.high")}</option>
                      <option value="medium">{t("inspector.priority.medium")}</option>
                      <option value="low">{t("inspector.priority.low")}</option>
                    </select>
                  </td>
                  <td className="px-2 py-3 text-nc-soft">
                    <span className="block pb-1">{formatDueDate(task.dueDate)}</span>
                    <label className="sr-only" htmlFor={`inbox-due-${task.id}`}>{t("inbox.triage.due")}</label>
                    <input
                      id={`inbox-due-${task.id}`}
                      type="date"
                      value={task.dueDate?.slice(0, 10) ?? ""}
                      onChange={(event) => { void run(() => onPatchTask(task.id, { dueDate: event.target.value || null })); }}
                      className="w-32 rounded-nc-sm border border-nc-line-faint bg-nc-well/60 px-1.5 py-1 text-xs text-nc-text"
                    />
                  </td>
                  <td className="px-2 py-3">
                    <label className="sr-only" htmlFor={`inbox-workstream-${task.id}`}>{t("inbox.triage.workstream")}</label>
                    <select
                      id={`inbox-workstream-${task.id}`}
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value) void run(() => onSetWorkstream(task.id, event.target.value));
                      }}
                      className="w-44 rounded-nc-sm border border-nc-line-faint bg-nc-well/60 px-1.5 py-1 text-xs text-nc-text"
                    >
                      <option value="">{t("inbox.triage.chooseWorkstream")}</option>
                      {workstreams.map((workstream) => <option key={workstream.id} value={workstream.id}>{workstream.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => { void run(() => onClearInbox(task)); }} className="whitespace-nowrap rounded-nc-sm border border-nc-accent/30 px-2 py-1 text-xs text-nc-accent-strong hover:bg-nc-accent/10">
                        {t("inbox.triage.clearInbox")}
                      </button>
                      <button type="button" onClick={() => onReveal(task)} className="whitespace-nowrap rounded-nc-sm border border-nc-line px-2 py-1 text-xs text-nc-text hover:bg-nc-fill">
                        {t("inbox.triage.openInspector")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
