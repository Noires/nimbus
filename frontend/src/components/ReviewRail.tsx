import { useState } from "react";
import type { Dependency, Task } from "../store";
import { selectReviewQueues, type ReviewQueues } from "../data/reviewSelectors";
import { dateLocale, useT } from "../i18n";
import { localDayKey } from "../utils/capacity";
import { NightCartographyRowAction, NightCartographyTaskRow } from "./NightCartography";
import { cardAccent } from "../utils/colors";

export type ReviewRailState = "loading" | "error" | "ready";
export type ReviewQueueKey = keyof ReviewQueues;

interface ReviewRailProps {
  tasks: Task[];
  dependencies: Dependency[];
  state: ReviewRailState;
  selectedQueue?: ReviewQueueKey;
  now?: Date;
  onComplete: (task: Task) => Promise<void>;
  onOpenInspector: (task: Task) => void;
  onReveal: (task: Task) => void;
  onFocus: (task: Task) => void;
  onOpenToday: () => void;
  onOpenInbox: () => void;
}

const QUEUES: ReviewQueueKey[] = ["overdue", "dueSoon", "blocked", "stale", "inbox", "recentlyCompleted"];

export function ReviewRail({
  tasks,
  dependencies,
  state,
  selectedQueue = "overdue",
  now,
  onComplete,
  onOpenInspector,
  onReveal,
  onFocus,
  onOpenToday,
  onOpenInbox,
}: ReviewRailProps) {
  const t = useT();
  const [activeQueue, setActiveQueue] = useState<ReviewQueueKey>(selectedQueue);
  const [actionError, setActionError] = useState<string | null>(null);
  const queues = selectReviewQueues({ tasks, dependencies, now });
  const queueTasks = queues[activeQueue];
  const completedQueue = activeQueue === "recentlyCompleted";
  const todayKey = localDayKey(now ?? new Date());

  const run = (action: () => Promise<void>) => {
    setActionError(null);
    void action().catch(() => setActionError(t("review.actionFailed")));
  };

  return (
    <section className="p-4" aria-label={t("review.label")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="sr-only">{t("review.title")}</h2>
          <p className="mt-1 text-xs leading-5 text-nc-muted">{t("review.subtitle")}</p>
        </div>
        <span className="rounded-full bg-nc-fill px-2 py-1 text-xs text-nc-muted">{queueTasks.length}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1" aria-label={t("review.queuesLabel")}>
        {QUEUES.map((queue) => (
          <button
            key={queue}
            type="button"
            aria-pressed={activeQueue === queue}
            onClick={() => setActiveQueue(queue)}
            className={`rounded-nc-sm border px-2 py-1 text-xs ${
              activeQueue === queue
                ? "border-nc-accent-border bg-nc-accent-muted text-nc-accent-strong"
                : "border-nc-line text-nc-soft hover:bg-nc-fill"
            }`}
          >
            {t(`review.queue.${queue}`)}
          </button>
        ))}
      </div>

      {actionError && <p role="alert" className="mt-3 text-xs text-nc-danger">{actionError}</p>}
      {state === "loading" ? (
        <p className="mt-5 text-xs text-nc-faint">{t("review.loading")}</p>
      ) : state === "error" ? (
        <p role="alert" className="mt-5 text-xs text-nc-danger">{t("review.error")}</p>
      ) : queueTasks.length === 0 ? (
        <p className="mt-5 text-xs leading-5 text-nc-faint">{t("review.empty")}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {queueTasks.map((task) => {
            const overdue = !task.done && task.dueDate !== null && localDayKey(task.dueDate) < todayKey;
            return (
              <NightCartographyTaskRow
                key={task.id}
                accent={task.color || cardAccent(task.id)}
                title={task.title}
                titleTone={completedQueue ? "text-nc-faint line-through" : "text-nc-text"}
                meta={<>
                  {task.dueDate && (
                    <span className={overdue ? "text-nc-warning" : undefined}>
                      {t("review.dueDate", { date: new Date(task.dueDate).toLocaleDateString(dateLocale(), { dateStyle: "medium" }) })}
                    </span>
                  )}
                  <span data-task-priority={task.priority} className="rounded-nc-sm bg-nc-fill-faint px-1.5 py-0.5 text-nc-soft">
                    {t(`inspector.priority.${task.priority}`)}
                  </span>
                </>}
                actions={<>
                  {!completedQueue && <NightCartographyRowAction label={t("review.complete")} onClick={() => run(() => onComplete(task))} />}
                  <NightCartographyRowAction label={t("review.openInspector")} onClick={() => onOpenInspector(task)} inspectorTaskId={task.id} />
                  <NightCartographyRowAction label={t("review.reveal")} onClick={() => onReveal(task)} />
                  {!completedQueue && <NightCartographyRowAction label={t("review.focus")} onClick={() => onFocus(task)} />}
                </>}
              />
            );
          })}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-nc-line-faint pt-3">
        <NightCartographyRowAction label={t("review.openToday")} onClick={onOpenToday} />
        <NightCartographyRowAction label={t("review.openInbox")} onClick={onOpenInbox} />
      </div>
    </section>
  );
}
