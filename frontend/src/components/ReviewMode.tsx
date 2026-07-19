import { AnimatePresence, motion } from "framer-motion";
import { useStore, CARD_W, CARD_H } from "../store";
import { buildReviewQueue } from "../utils/reviewQueue";
import { t, useT } from "../i18n";

// Weekly Review Flight: the camera flies card-to-card in triage order;
// single keys act on the current card and advance.

export function startReview() {
  const store = useStore.getState();
  const queue = buildReviewQueue(store.tasks);
  if (queue.length === 0) {
    store.showToast(`${t("c.review.nothing")} ✨`);
    return;
  }
  store.setLens("heat");
  store.setReview({ queue, index: 0, cleared: 0, rescheduled: 0, archived: 0 });
  flyToCurrent(queue[0]);
}

export function exitReview(showSummary = true) {
  const store = useStore.getState();
  const review = store.review;
  store.setReview(null);
  store.setLens("off");
  if (showSummary && review) {
    store.showToast(
      t("c.review.summary", {
        cleared: review.cleared,
        rescheduled: review.rescheduled,
        archived: review.archived,
      }),
    );
  }
}

function flyToCurrent(taskId: string) {
  const store = useStore.getState();
  const task = store.tasks.find((t) => t.id === taskId);
  if (task) store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, 1);
}

function advance(counts?: Partial<{ cleared: number; rescheduled: number; archived: number }>) {
  const store = useStore.getState();
  const review = store.review;
  if (!review) return;
  const next = {
    ...review,
    cleared: review.cleared + (counts?.cleared ?? 0),
    rescheduled: review.rescheduled + (counts?.rescheduled ?? 0),
    archived: review.archived + (counts?.archived ?? 0),
    index: review.index + 1,
  };
  if (next.index >= next.queue.length) {
    store.setReview(next); // keep counts for the summary
    exitReview();
    return;
  }
  store.setReview(next);
  flyToCurrent(next.queue[next.index]);
}

export function reviewAct(action: "done" | "archive" | "push" | "priority" | "skip") {
  const store = useStore.getState();
  const review = store.review;
  if (!review) return;
  const task = store.tasks.find((t) => t.id === review.queue[review.index]);
  if (!task) {
    advance();
    return;
  }
  switch (action) {
    case "done":
      void store.patchTask(task.id, { done: true }).catch((e) => console.error(e));
      advance({ cleared: 1 });
      break;
    case "archive":
      void store.patchTask(task.id, { archivedAt: new Date().toISOString() }).catch((e) => console.error(e));
      advance({ archived: 1 });
      break;
    case "push": {
      const base = task.dueDate ? new Date(task.dueDate) : new Date();
      base.setDate(base.getDate() + 7);
      void store.patchTask(task.id, { dueDate: base.toISOString() }).catch((e) => console.error(e));
      advance({ rescheduled: 1 });
      break;
    }
    case "priority": {
      const cycle: Record<string, string> = { high: "medium", medium: "low", low: "high" };
      void store
        .patchTask(task.id, { priority: cycle[task.priority] ?? "medium" })
        .catch((e) => console.error(e));
      break; // stays on the card so you can see the change
    }
    case "skip":
      advance();
      break;
  }
}

const KEYS: Array<{ key: string; labelKey: string; action: Parameters<typeof reviewAct>[0] }> = [
  { key: "D", labelKey: "c.review.done", action: "done" },
  { key: "A", labelKey: "c.review.archive", action: "archive" },
  { key: "S", labelKey: "c.review.push", action: "push" },
  { key: "P", labelKey: "c.review.priority", action: "priority" },
  { key: "→", labelKey: "c.review.skip", action: "skip" },
];

export function ReviewHud() {
  const review = useStore((s) => s.review);
  const tasks = useStore((s) => s.tasks);
  const t = useT();
  const current = review ? tasks.find((tk) => tk.id === review.queue[review.index]) : null;

  return (
    <AnimatePresence>
      {review && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 rounded-xl bg-[#1a1d24]/95 backdrop-blur-md border border-cyan-500/30 px-4 py-2.5 shadow-2xl"
        >
          <span className="text-xs text-cyan-300 whitespace-nowrap">
            ✈ {t("c.review.progress", { index: review.index + 1, total: review.queue.length })}
          </span>
          <span className="text-xs text-gray-200 max-w-48 truncate">
            {current?.title ?? "…"}
          </span>
          <div className="w-px h-5 bg-white/10" />
          {KEYS.map(({ key, labelKey, action }) => (
            <button
              key={key}
              onClick={() => reviewAct(action)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors whitespace-nowrap"
            >
              <kbd className="px-1 py-0.5 rounded bg-white/10 text-gray-300">{key}</kbd>
              {t(labelKey)}
            </button>
          ))}
          <button
            onClick={() => exitReview()}
            className="text-[10px] text-gray-500 hover:text-gray-200 transition-colors"
          >
            {t("c.review.end")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
