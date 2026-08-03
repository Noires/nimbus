import { useState } from "react";
import type { Dependency, Task } from "../store";
import { selectReviewQueues, type ReviewQueues } from "../data/reviewSelectors";
import { useT } from "../i18n";

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

  const run = (action: () => Promise<void>) => {
    setActionError(null);
    void action().catch(() => setActionError(t("review.actionFailed")));
  };

  return (
    <section className="p-4" aria-label={t("review.label")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-200">{t("review.title")}</h2>
          <p className="mt-1 text-xs leading-5 text-gray-400">{t("review.subtitle")}</p>
        </div>
        <span className="rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-100">{queueTasks.length}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1" aria-label={t("review.queuesLabel")}>
        {QUEUES.map((queue) => (
          <button
            key={queue}
            type="button"
            aria-pressed={activeQueue === queue}
            onClick={() => setActiveQueue(queue)}
            className={`rounded border px-2 py-1 text-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
              activeQueue === queue
                ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                : "border-white/15 text-gray-300 hover:bg-white/10"
            }`}
          >
            {t(`review.queue.${queue}`)}
          </button>
        ))}
      </div>

      {actionError && <p role="alert" className="mt-3 text-xs text-red-300">{actionError}</p>}
      {state === "loading" ? (
        <p className="mt-5 text-xs text-gray-500">{t("review.loading")}</p>
      ) : state === "error" ? (
        <p role="alert" className="mt-5 text-xs text-red-300">{t("review.error")}</p>
      ) : queueTasks.length === 0 ? (
        <p className="mt-5 text-xs leading-5 text-gray-500">{t("review.empty")}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {queueTasks.map((task) => (
            <li key={task.id} className="night-cartography__task-row rounded-lg border border-white/10 bg-[#0f0f13]/40 p-2.5">
              <p className={`min-w-0 text-xs font-medium ${completedQueue ? "text-gray-500 line-through" : "text-gray-100"}`}>{task.title}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {!completedQueue && <ActionButton label={t("review.complete")} onClick={() => run(() => onComplete(task))} />}
                <ActionButton label={t("review.openInspector")} onClick={() => onOpenInspector(task)} inspectorTaskId={task.id} />
                <ActionButton label={t("review.reveal")} onClick={() => onReveal(task)} />
                {!completedQueue && <ActionButton label={t("review.focus")} onClick={() => onFocus(task)} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <ActionButton label={t("review.openToday")} onClick={onOpenToday} />
        <ActionButton label={t("review.openInbox")} onClick={onOpenInbox} />
      </div>
    </section>
  );
}

function ActionButton({ label, onClick, inspectorTaskId }: { label: string; onClick: () => void; inspectorTaskId?: string }) {
  return <button type="button" onClick={onClick} data-mobile-inspector-task={inspectorTaskId} className="rounded border border-white/15 px-2 py-1 text-[10px] text-gray-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">{label}</button>;
}
