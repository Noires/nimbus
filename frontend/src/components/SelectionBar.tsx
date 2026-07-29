import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store";
import { clusterHue } from "../utils/colors";
import { history, type Op } from "../engine/history";
import { previewArrangementOperation, type ArrangementPreview } from "../engine/arrangementOperation";
import { useT } from "../i18n";

// Floating bulk-action bar for the lasso selection. Every action is a single
// batch history op — one Ctrl+Z reverts the whole thing.
export function SelectionBar({ canvasId, tidyEnabled = false }: { canvasId: string; tidyEnabled?: boolean }) {
  const selectedIds = useStore((s) => s.selectedIds);
  const [tagInput, setTagInput] = useState<string | null>(null);
  const [tidyPreview, setTidyPreview] = useState<ArrangementPreview | null>(null);
  const t = useT();
  const selectedKey = [...selectedIds].sort().join("\u0000");

  useEffect(() => {
    setTidyPreview(null);
  }, [selectedKey]);

  const run = (fn: () => Promise<void>) => fn().catch((e) => console.error(e));

  const bubbleIt = async () => {
    const store = useStore.getState();
    const ids = [...store.selectedIds];
    if (ids.length < 2) return;
    await store.packCluster(ids);
    const title = prompt(t("c.selection.bubblePrompt"), "") ?? "";
    await store.pinBubble(canvasId, ids, title, clusterHue(ids.slice().sort()[0]));
    store.clearSelection();
    store.showToast(t("c.selection.bubbled", { count: ids.length }));
  };

  const addTag = async () => {
    const tag = tagInput?.trim();
    setTagInput(null);
    if (!tag) return;
    const store = useStore.getState();
    const targets = store.tasks.filter(
      (t) => store.selectedIds.includes(t.id) && !t.tags.includes(tag),
    );
    if (targets.length === 0) return;
    // Per-task tag arrays differ, so patch individually but record one batch op.
    const ops: Op[] = targets.map((t) => ({
      kind: "patch",
      taskId: t.id,
      redo: { tags: [...t.tags, tag] },
      undo: { tags: t.tags },
    }));
    history.push({ op: { kind: "batch", ops }, label: `tagged ${targets.length} tasks` });
    for (const t of targets) {
      await store.patchTask(t.id, { tags: [...t.tags, tag] }, { record: false });
    }
    store.showToast(t("c.selection.tagged", { count: targets.length, tag }));
  };

  const previewSelectedTidy = () => {
    const store = useStore.getState();
    if (store.selectedIds.length < 2) return;
    setTidyPreview(previewArrangementOperation({
      scope: { kind: "selected", taskIds: [...store.selectedIds] },
      tasks: store.tasks,
      workstreams: store.workstreams.map((workstream) => ({
        id: workstream.id,
        pinned: workstream.pinned,
        protected: workstream.protected,
        taskIds: workstream.memberships.map((membership) => membership.taskId),
      })),
    }));
  };

  return (
    <AnimatePresence>
      {selectedIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 rounded-xl bg-[#1a1d24]/95 backdrop-blur-md border border-purple-500/40 px-4 py-2.5 shadow-2xl"
        >
          <span role="status" aria-live="polite" aria-atomic="true" className="text-xs text-purple-300 whitespace-nowrap">
            {t("c.selection.count", { count: selectedIds.length })}
          </span>
          <div className="w-px h-5 bg-white/10" />

          <BarButton
            label={`✓ ${t("c.selection.complete")}`}
            ariaLabel={t("c.selection.complete")}
            onClick={() =>
              run(() => useStore.getState().bulkPatch(selectedIds, { done: true }, `completed ${selectedIds.length} tasks`))
            }
          />
          <BarButton
            label={`⏱ ${t("c.selection.snooze")}`}
            ariaLabel={t("c.selection.snooze")}
            onClick={() =>
              run(() =>
                useStore.getState().bulkPatch(
                  selectedIds,
                  { snoozedUntil: new Date(Date.now() + 7 * 86_400_000).toISOString() },
                  `snoozed ${selectedIds.length} tasks`,
                ),
              )
            }
          />
          {tagInput === null ? (
            <BarButton label={`# ${t("c.selection.tag")}`} ariaLabel={t("c.selection.tag")} onClick={() => setTagInput("")} />
          ) : (
            <input
              autoFocus
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") void run(addTag);
                if (e.key === "Escape") setTagInput(null);
              }}
              onBlur={() => setTagInput(null)}
              placeholder={t("c.selection.tagPlaceholder")}
              className="w-20 h-6 px-2 rounded bg-[#0f0f13] border border-white/15 text-xs outline-none"
            />
          )}
          <BarButton
            label={`⇶ ${t("c.selection.flowFill")}`}
            ariaLabel={t("c.selection.flowFill")}
            onClick={() => run(() => useStore.getState().autoScheduleTasks(selectedIds))}
          />
          {tidyEnabled && selectedIds.length >= 2 && (tidyPreview ? (
            <SelectionTidyPreview
              preview={tidyPreview}
              onApply={async () => {
                if (await useStore.getState().applyArrangementPreview(tidyPreview)) setTidyPreview(null);
              }}
              onCancel={() => setTidyPreview(null)}
            />
          ) : (
            <BarButton label={`⇄ ${t("c.selection.tidy")}`} ariaLabel={t("c.selection.tidy")} onClick={previewSelectedTidy} />
          ))}
          <BarButton label={`◯ ${t("c.selection.bubbleIt")}`} ariaLabel={t("c.selection.bubbleIt")} onClick={() => run(bubbleIt)} />
          {selectedIds.length >= 2 && (
            <BarButton
              label={`⇢ ${t("c.selection.merge")}`}
              ariaLabel={t("c.selection.merge")}
              onClick={() => run(() => useStore.getState().mergeTasksAction(selectedIds))}
            />
          )}
          <BarButton label={`▶ ${t("c.selection.focus")}`} ariaLabel={t("c.selection.focus")} onClick={() => useStore.getState().startFocus(selectedIds)} />
          <BarButton
            label={`🗑 ${t("c.selection.delete")}`}
            ariaLabel={t("c.selection.delete")}
            danger
            onClick={() => {
              if (confirm(t("c.selection.deleteConfirm", { count: selectedIds.length }))) {
                run(() => useStore.getState().bulkDelete(selectedIds));
              }
            }}
          />

          <div className="w-px h-5 bg-white/10" />
          <button
            onClick={() => useStore.getState().clearSelection()}
            aria-label={t("c.selection.clearLabel")}
            className="min-w-11 min-h-11 text-[10px] text-gray-500 hover:text-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
          >
            {t("c.selection.clear")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SelectionTidyPreview({
  preview,
  onApply,
  onCancel,
}: {
  preview: ArrangementPreview;
  onApply: () => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [isApplying, setIsApplying] = useState(false);
  const skippedByReason = preview.skipped.reduce<Record<string, number>>((counts, skipped) => {
    counts[skipped.reason] = (counts[skipped.reason] ?? 0) + 1;
    return counts;
  }, {});
  const skipReasonKeys: Record<string, string> = {
    "missing-task": "c.selection.tidySkippedMissing",
    "protected-task": "c.selection.tidySkippedProtectedTask",
    "pinned-workstream": "c.selection.tidySkippedPinnedWorkstream",
    "protected-workstream": "c.selection.tidySkippedProtectedWorkstream",
  };
  const apply = async () => {
    if (isApplying) return;
    setIsApplying(true);
    try {
      await onApply();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="flex items-center gap-2" aria-live="polite" aria-busy={isApplying}>
      <span className="text-[10px] text-cyan-100">
        {t("c.selection.tidyPreview", {
          moved: preview.moved.length,
          unchanged: preview.unchanged.length,
          skipped: preview.skipped.length,
        })}
      </span>
      {Object.entries(skippedByReason).map(([reason, count]) => (
        <span key={reason} className="text-[10px] text-amber-200">
          {t(skipReasonKeys[reason], { count })}
        </span>
      ))}
      <BarButton label={t("c.selection.applyTidy")} onClick={() => void apply()} disabled={isApplying} />
      <BarButton label={t("c.selection.cancelTidy")} onClick={onCancel} />
    </div>
  );
}

function BarButton({ label, ariaLabel = label, onClick, danger, disabled = false }: { label: string; ariaLabel?: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`min-w-11 min-h-11 text-[11px] whitespace-nowrap px-2 py-1 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 ${
        disabled
          ? "cursor-not-allowed text-gray-500"
          : danger ? "text-gray-400 hover:text-red-400 hover:bg-red-500/10" : "text-gray-300 hover:text-white hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}
