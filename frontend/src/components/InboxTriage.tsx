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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-200">{t("inbox.triage.title")}</h2>
          <p className="mt-1 text-xs leading-5 text-gray-400">{t("inbox.triage.subtitle")}</p>
        </div>
        <span className="rounded-full bg-purple-400/10 px-2 py-1 text-xs text-purple-200">{inboxTasks.length}</span>
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
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0f0f13]/60 px-2.5 py-2 text-xs outline-none transition-colors focus:border-purple-400 focus-visible:ring-2 focus-visible:ring-purple-300"
        />
        <button type="submit" className="rounded-lg bg-purple-500/20 px-3 py-2 text-xs text-purple-100 hover:bg-purple-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300">
          {t("inbox.triage.capture")}
        </button>
      </form>
      {actionError && <p role="alert" className="mt-2 text-xs text-red-300">{actionError}</p>}

      <div className="mt-4 overflow-x-auto">
        {state === "loading" ? (
          <p className="text-xs text-gray-500">{t("inbox.triage.loading")}</p>
        ) : state === "error" ? (
          <p role="alert" className="text-xs text-red-300">{t("inbox.triage.error")}</p>
        ) : inboxTasks.length === 0 ? (
          <p className="text-xs leading-5 text-gray-500">{t("inbox.triage.empty")}</p>
        ) : (
          <table className="w-full min-w-[34rem] text-left text-xs" aria-label={t("inbox.triage.tableLabel")}>
            <thead className="border-b border-white/10 text-[10px] uppercase tracking-wide text-gray-500">
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
                <tr key={task.id} className="border-b border-white/5 align-top">
                  <td className="max-w-48 px-2 py-3 text-gray-100">
                    <div className="truncate font-medium">{task.title}</div>
                    <div className="mt-1 truncate text-[10px] text-gray-500">{task.tags.map((tag) => `#${tag}`).join(" ") || t("inbox.triage.noTags")}</div>
                  </td>
                  <td className="px-2 py-3">
                    <label className="sr-only" htmlFor={`inbox-priority-${task.id}`}>{t("inbox.triage.priority")}</label>
                    <select
                      id={`inbox-priority-${task.id}`}
                      value={task.priority}
                      onChange={(event) => { void run(() => onPatchTask(task.id, { priority: event.target.value })); }}
                      className="rounded border border-white/10 bg-[#0f0f13]/60 px-1.5 py-1 text-xs text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                    >
                      <option value="high">{t("inspector.priority.high")}</option>
                      <option value="medium">{t("inspector.priority.medium")}</option>
                      <option value="low">{t("inspector.priority.low")}</option>
                    </select>
                  </td>
                  <td className="px-2 py-3 text-gray-300">
                    <span className="block pb-1">{formatDueDate(task.dueDate)}</span>
                    <label className="sr-only" htmlFor={`inbox-due-${task.id}`}>{t("inbox.triage.due")}</label>
                    <input
                      id={`inbox-due-${task.id}`}
                      type="date"
                      value={task.dueDate?.slice(0, 10) ?? ""}
                      onChange={(event) => { void run(() => onPatchTask(task.id, { dueDate: event.target.value ? new Date(event.target.value).toISOString() : null })); }}
                      className="w-28 rounded border border-white/10 bg-[#0f0f13]/60 px-1.5 py-1 text-xs text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
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
                      className="max-w-32 rounded border border-white/10 bg-[#0f0f13]/60 px-1.5 py-1 text-xs text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                    >
                      <option value="">{t("inbox.triage.chooseWorkstream")}</option>
                      {workstreams.map((workstream) => <option key={workstream.id} value={workstream.id}>{workstream.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => { void run(() => onClearInbox(task)); }} className="rounded border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                        {t("inbox.triage.clearInbox")}
                      </button>
                      <button type="button" onClick={() => onReveal(task)} className="rounded border border-white/15 px-2 py-1 text-[10px] text-gray-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300">
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
