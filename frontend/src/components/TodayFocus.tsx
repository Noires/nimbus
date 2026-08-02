import { useState } from "react";
import type { Dependency, Task } from "../store";
import { selectTodayFocus } from "../data/todayFocusSelectors";
import { dateLocale, useT } from "../i18n";
import { localDayKey } from "../utils/capacity";

export type TodayFocusState = "loading" | "error" | "ready";

interface TodayFocusProps {
  tasks: Task[];
  dependencies: Dependency[];
  state: TodayFocusState;
  now?: Date;
  focusEnabled?: boolean;
  blockerStatusEnabled?: boolean;
  onComplete: (task: Task) => Promise<void>;
  onReturnToInbox: (task: Task) => Promise<void>;
  onOpenInspector: (task: Task) => void;
  onReveal: (task: Task) => void;
  onFocus: (task: Task) => void;
}

const MAX_ITEMS = 8;

function dueLabel(task: Task, now: Date, t: (key: string, vars?: Record<string, string | number>) => string): string | null {
  if (!task.dueDate) return null;
  const due = /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)
    ? new Date(`${task.dueDate}T00:00:00`)
    : new Date(task.dueDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (localDayKey(task.dueDate) < localDayKey(now)) return t("today.overdue");
  if (localDayKey(task.dueDate) === localDayKey(now)) return t("today.today");
  return due.toLocaleDateString(dateLocale(), { dateStyle: "medium" });
}

export function TodayFocus({
  tasks,
  dependencies,
  state,
  now = new Date(),
  focusEnabled = false,
  blockerStatusEnabled = false,
  onComplete,
  onReturnToInbox,
  onOpenInspector,
  onReveal,
  onFocus,
}: TodayFocusProps) {
  const t = useT();
  const [actionError, setActionError] = useState<string | null>(null);
  const sections = selectTodayFocus({ tasks, dependencies, now, limit: MAX_ITEMS });
  const hasTasks = Object.values(sections).some((section) => section.length > 0);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const blockerTitles = new Map(
    dependencies
      .filter((dependency) => !taskById.get(dependency.blockerId)?.done)
      .map((dependency) => [dependency.blockedId, taskById.get(dependency.blockerId)?.title ?? dependency.blockerId]),
  );

  const run = (action: () => Promise<void>) => {
    setActionError(null);
    void action().catch(() => setActionError(t("today.actionFailed")));
  };

  if (state === "loading") {
    return <section className="p-4" aria-label={t("today.label")}><p className="text-xs text-gray-500">{t("today.loading")}</p></section>;
  }
  if (state === "error") {
    return <section className="p-4" aria-label={t("today.label")}><p role="alert" className="text-xs text-red-300">{t("today.error")}</p></section>;
  }

  return (
    <section className="p-4" aria-label={t("today.label")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-200">{t("today.title")}</h2>
          <p className="mt-1 text-xs leading-5 text-gray-400">{t("today.subtitle")}</p>
        </div>
        <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100">{sections.due.length + sections.ready.length}</span>
      </div>
      {actionError && <p role="alert" className="mt-3 text-xs text-red-300">{actionError}</p>}
      {!hasTasks ? (
        <p className="mt-5 text-xs leading-5 text-gray-500">{t("today.empty")}</p>
      ) : (
        <div className="mt-4 space-y-5">
          <TaskSection title={t("today.due")} tasks={sections.due} blockerTitles={blockerTitles} blockerStatusEnabled={blockerStatusEnabled} now={now} t={t} onComplete={onComplete} onReturnToInbox={onReturnToInbox} onOpenInspector={onOpenInspector} onReveal={onReveal} onFocus={onFocus} focusEnabled={focusEnabled} run={run} />
          <TaskSection title={t("today.ready")} tasks={sections.ready} blockerTitles={blockerTitles} blockerStatusEnabled={blockerStatusEnabled} now={now} t={t} onComplete={onComplete} onReturnToInbox={onReturnToInbox} onOpenInspector={onOpenInspector} onReveal={onReveal} onFocus={onFocus} focusEnabled={focusEnabled} run={run} />
          <TaskSection title={t("today.blocked")} tasks={sections.blocked} blockerTitles={blockerTitles} blockerStatusEnabled={blockerStatusEnabled} now={now} t={t} onComplete={onComplete} onReturnToInbox={onReturnToInbox} onOpenInspector={onOpenInspector} onReveal={onReveal} onFocus={onFocus} focusEnabled={focusEnabled} run={run} />
          <TaskSection title={t("today.completed")} tasks={sections.recentlyCompleted} blockerTitles={blockerTitles} blockerStatusEnabled={blockerStatusEnabled} now={now} t={t} onComplete={onComplete} onReturnToInbox={onReturnToInbox} onOpenInspector={onOpenInspector} onReveal={onReveal} onFocus={onFocus} focusEnabled={false} run={run} completed />
        </div>
      )}
    </section>
  );
}

function TaskSection({
  title,
  tasks,
  blockerTitles,
  blockerStatusEnabled,
  now,
  t,
  onComplete,
  onReturnToInbox,
  onOpenInspector,
  onReveal,
  onFocus,
  focusEnabled,
  run,
  completed = false,
}: {
  title: string;
  tasks: Task[];
  blockerTitles: Map<string, string>;
  blockerStatusEnabled: boolean;
  now: Date;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onComplete: (task: Task) => Promise<void>;
  onReturnToInbox: (task: Task) => Promise<void>;
  onOpenInspector: (task: Task) => void;
  onReveal: (task: Task) => void;
  onFocus: (task: Task) => void;
  focusEnabled: boolean;
  run: (action: () => Promise<void>) => void;
  completed?: boolean;
}) {
  return (
    <section aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-gray-300">{title}</h3>
        {tasks.length > 0 && <span className="text-[10px] text-gray-300">{t("today.showing", { count: tasks.length, limit: MAX_ITEMS })}</span>}
      </div>
      {tasks.length === 0 ? (
        <p className="mt-1 text-xs text-gray-300">{t("today.sectionEmpty")}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {tasks.map((task) => {
            const due = dueLabel(task, now, t);
            const blockerTitle = blockerTitles.get(task.id);
            return (
              <li key={task.id} className="rounded-lg border border-white/10 bg-[#0f0f13]/40 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className={`min-w-0 text-xs font-medium ${completed ? "text-gray-500 line-through" : "text-gray-100"}`}>{task.title}</p>
                  {due && <span className="shrink-0 text-[10px] text-amber-200">{due}</span>}
                </div>
                {blockerStatusEnabled && blockerTitle && <p className="mt-1 text-xs text-amber-100">{t("today.blockedBy", { title: blockerTitle })}</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {!completed && <ActionButton label={t("today.complete")} onClick={() => run(() => onComplete(task))} />}
                  <ActionButton label={t("today.openInspector")} onClick={() => onOpenInspector(task)} inspectorTaskId={task.id} />
                  <ActionButton label={t("today.reveal")} onClick={() => onReveal(task)} />
                  {!completed && <ActionButton label={t("today.returnToInbox")} onClick={() => run(() => onReturnToInbox(task))} />}
                  {focusEnabled && !completed && <ActionButton label={t("today.focus")} onClick={() => onFocus(task)} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ActionButton({ label, onClick, inspectorTaskId }: { label: string; onClick: () => void; inspectorTaskId?: string }) {
  return <button type="button" onClick={onClick} data-mobile-inspector-task={inspectorTaskId} className="rounded border border-white/15 px-2 py-1 text-[10px] text-gray-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">{label}</button>;
}
