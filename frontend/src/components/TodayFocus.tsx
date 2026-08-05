import { useState } from "react";
import type { Dependency, Task } from "../store";
import { selectTodayFocus } from "../data/todayFocusSelectors";
import { dateLocale, useT } from "../i18n";
import { localDayKey } from "../utils/capacity";
import { NightCartographyRowAction, NightCartographyTaskRow } from "./NightCartography";
import { cardAccent } from "../utils/colors";

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
    return <section className="p-4" aria-label={t("today.label")}><p className="text-xs text-nc-faint">{t("today.loading")}</p></section>;
  }
  if (state === "error") {
    return <section className="p-4" aria-label={t("today.label")}><p role="alert" className="text-xs text-nc-danger">{t("today.error")}</p></section>;
  }

  return (
    <section className="p-4" aria-label={t("today.label")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="sr-only">{t("today.title")}</h2>
          <p className="mt-1 text-xs leading-5 text-nc-muted">{t("today.subtitle")}</p>
        </div>
        <span className="rounded-full bg-nc-accent-muted px-2 py-1 text-xs text-nc-accent-strong">{sections.due.length + sections.ready.length}</span>
      </div>
      {actionError && <p role="alert" className="mt-3 text-xs text-nc-danger">{actionError}</p>}
      {!hasTasks ? (
        <p className="mt-5 text-xs leading-5 text-nc-faint">{t("today.empty")}</p>
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h3 className="rail-section__label rail-section__label--inline">{title}</h3>
        {tasks.length > 0 && <span className="whitespace-nowrap text-xs text-nc-soft">{t("today.showing", { count: tasks.length, limit: MAX_ITEMS })}</span>}
      </div>
      {tasks.length === 0 ? (
        <p className="mt-1 text-xs text-nc-soft">{t("today.sectionEmpty")}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {tasks.map((task) => {
            const due = dueLabel(task, now, t);
            // Amber only under real time pressure; future dates stay quiet.
            const urgent = !completed && task.dueDate !== null && localDayKey(task.dueDate) <= localDayKey(now);
            const blockerTitle = blockerTitles.get(task.id);
            return (
              <NightCartographyTaskRow
                key={task.id}
                accent={task.color || cardAccent(task.id)}
                title={task.title}
                titleTone={completed ? "text-nc-faint line-through" : "text-nc-text"}
                badge={due && <span className={urgent ? "text-nc-warning" : "text-nc-muted"}>{due}</span>}
                actions={<>
                  {!completed && <NightCartographyRowAction label={t("today.complete")} onClick={() => run(() => onComplete(task))} />}
                  <NightCartographyRowAction label={t("today.openInspector")} onClick={() => onOpenInspector(task)} inspectorTaskId={task.id} />
                  <NightCartographyRowAction label={t("today.reveal")} onClick={() => onReveal(task)} />
                  {!completed && <NightCartographyRowAction label={t("today.returnToInbox")} onClick={() => run(() => onReturnToInbox(task))} />}
                  {focusEnabled && !completed && <NightCartographyRowAction label={t("today.focus")} onClick={() => onFocus(task)} />}
                </>}
              >
                {blockerStatusEnabled && blockerTitle && <p className="mt-1 text-xs text-nc-muted">{t("today.blockedBy", { title: blockerTitle })}</p>}
              </NightCartographyTaskRow>
            );
          })}
        </ul>
      )}
    </section>
  );
}
