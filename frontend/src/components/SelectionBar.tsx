import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { chromeSpring } from "../utils/motion";
import { useStore } from "../store";
import { clusterHue } from "../utils/colors";
import { history, type Op } from "../engine/history";
import { isArrangementPreviewCurrent, previewArrangementOperation, type ArrangementPreview } from "../engine/arrangementOperation";
import type { ArrangementStrategy } from "../engine/arrangementOperation";
import { selectEffectiveZone } from "../data/spatialZoneSelectors";
import { useT } from "../i18n";

// Floating bulk-action bar for the lasso selection. Every action is a single
// batch history op — one Ctrl+Z reverts the whole thing.
export function SelectionBar({ canvasId, tidyEnabled = false }: { canvasId: string; tidyEnabled?: boolean }) {
  const selectedIds = useStore((s) => s.selectedIds);
  const [tagInput, setTagInput] = useState<string | null>(null);
  const [tidyPreview, setTidyPreview] = useState<ArrangementPreview | null>(null);
  const [arrangeStrategy, setArrangeStrategy] = useState<ArrangementStrategy>("tidy-overlaps");
  const [restoreZoneTrigger, setRestoreZoneTrigger] = useState(false);
  const zoneTrigger = useRef<HTMLButtonElement>(null);
  const t = useT();
  const selectedKey = [...selectedIds].sort().join("\u0000");
  const zoneEligibleCount = useStore((store) => {
    if (store.selectedIds.length < 2) return 0;
    const preview = previewArrangementOperation({
      scope: { kind: "selected-zones", taskIds: [...store.selectedIds] }, tasks: store.tasks, zones: store.zones,
      workstreams: store.workstreams.map((workstream) => ({ id: workstream.id, pinned: workstream.pinned, protected: workstream.protected, taskIds: workstream.memberships.map((membership) => membership.taskId) })),
    });
    return preview.moved.length + preview.unchanged.length;
  });

  useEffect(() => {
    setTidyPreview(null);
  }, [selectedKey]);
  useEffect(() => {
    if (!restoreZoneTrigger) return;
    zoneTrigger.current?.focus();
    setRestoreZoneTrigger(false);
  }, [restoreZoneTrigger]);

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
      strategy: arrangeStrategy,
      tasks: store.tasks,
      workstreams: store.workstreams.map((workstream) => ({
        id: workstream.id,
        pinned: workstream.pinned,
        protected: workstream.protected,
        taskIds: workstream.memberships.map((membership) => membership.taskId),
      })),
    }));
  };
  const previewSelectedZones = () => {
    const store = useStore.getState();
    if (store.selectedIds.length < 2) return;
    setTidyPreview(previewArrangementOperation({
      scope: { kind: "selected-zones", taskIds: [...store.selectedIds] }, tasks: store.tasks, zones: store.zones,
      workstreams: store.workstreams.map((workstream) => ({ id: workstream.id, pinned: workstream.pinned, protected: workstream.protected, taskIds: workstream.memberships.map((membership) => membership.taskId) })),
    }));
  };

  return (
    <AnimatePresence>
      {selectedIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={chromeSpring}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[70] flex max-w-[calc(100vw-1rem)] flex-wrap justify-center items-center gap-2 rounded-nc-lg bg-nc-raised/95 backdrop-blur-md border border-nc-select-border px-4 py-2.5 shadow-nc-lg"
        >
          <span role="status" aria-live="polite" aria-atomic="true" className="text-xs text-nc-select whitespace-nowrap">
            {t("c.selection.count", { count: selectedIds.length })}
          </span>
          <div className="w-px h-5 bg-nc-fill" />

          <BarButton
            label={`✓ ${t("c.selection.complete")}`}
            ariaLabel={t("c.selection.complete")}
            onClick={() =>
              run(() => useStore.getState().bulkPatch(selectedIds, { done: true }, `completed ${selectedIds.length} tasks`))
            }
          />
          <BarButton
            label={`◷ ${t("c.selection.snooze")}`}
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
              className="w-20 h-6 px-2 rounded-nc-sm bg-nc-well border border-nc-line text-xs"
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
              onCancel={() => {
                const wasZonePreview = tidyPreview.scope === "selected-zones";
                setTidyPreview(null);
                if (wasZonePreview) setRestoreZoneTrigger(true);
              }}
            />
          ) : (
            <>
              <label className="sr-only" htmlFor="selected-arrange-mode">{t("c.selection.arrangeSelectedBy")}</label>
              <select id="selected-arrange-mode" aria-label={t("c.selection.arrangeSelectedBy")} value={arrangeStrategy} onChange={(event) => setArrangeStrategy(event.target.value as ArrangementStrategy)} className="max-w-24 bg-nc-well text-xs">
                <option value="tidy-overlaps">{t("c.selection.modeTidy")}</option><option value="grid">{t("c.selection.modeGrid")}</option><option value="tag">{t("c.selection.modeTag")}</option><option value="status">{t("c.selection.modeStatus")}</option><option value="priority">{t("c.selection.modePriority")}</option><option value="due">{t("c.selection.modeDue")}</option>
              </select>
              <BarButton label={`⇄ ${arrangeStrategy === "tidy-overlaps" ? t("c.selection.tidy") : arrangeStrategy === "grid" ? t("c.selection.arrangeGrid") : t("c.selection.previewArrange")}`} ariaLabel={t("c.selection.previewSelectedArrangement")} onClick={previewSelectedTidy} />
              <button ref={zoneTrigger} onClick={previewSelectedZones} aria-label={t("c.selection.arrangeZones")} disabled={zoneEligibleCount < 2} title={zoneEligibleCount < 2 ? t("c.selection.zoneNeedsEligible") : undefined} className="min-w-11 min-h-11 text-xs whitespace-nowrap px-2 py-1 rounded-nc-sm text-nc-soft hover:text-nc-text hover:bg-nc-filldisabled:cursor-not-allowed disabled:text-nc-faint">⌑ {t("c.selection.arrangeZones")}</button>
            </>
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
            label={`✖ ${t("c.selection.delete")}`}
            ariaLabel={t("c.selection.delete")}
            danger
            onClick={() => {
              if (confirm(t("c.selection.deleteConfirm", { count: selectedIds.length }))) {
                run(() => useStore.getState().bulkDelete(selectedIds));
              }
            }}
          />

          <div className="w-px h-5 bg-nc-fill" />
          <button
            onClick={() => useStore.getState().clearSelection()}
            aria-label={t("c.selection.clearLabel")}
            className="min-w-11 min-h-11 text-xs text-nc-faint hover:text-nc-text transition-colors"
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
  const [showZoneDetails, setShowZoneDetails] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const isZonePreview = preview.scope === "selected-zones";
  // Subscribe to the authoritative snapshot rather than waiting for Apply to
  // reject it. Cancel remains available so a stale preview cannot trap focus.
  const isCurrent = useStore((store) => isArrangementPreviewCurrent(
    preview,
    store.tasks,
    store.workstreams,
    isZonePreview ? store.zones : [],
  ));
  useEffect(() => {
    if (isZonePreview) root.current?.focus();
  }, [isZonePreview]);
  const skippedByReason = preview.skipped.reduce<Record<string, number>>((counts, skipped) => {
    counts[skipped.reason] = (counts[skipped.reason] ?? 0) + 1;
    return counts;
  }, {});
  const skipReasonKeys: Record<string, string> = {
    "missing-task": "c.selection.tidySkippedMissing",
    "protected-task": "c.selection.tidySkippedProtectedTask",
    "pinned-workstream": "c.selection.tidySkippedPinnedWorkstream",
    "protected-workstream": "c.selection.tidySkippedProtectedWorkstream",
    "outside-zone": "c.selection.zoneSkippedOutside",
    "ambiguous-zone": "c.selection.zoneSkippedAmbiguous",
    "zone-too-small": "c.selection.zoneSkippedSmall",
  };
  const zoneLabel = (zoneId?: string) => {
    const zone = useStore.getState().zones.find((candidate) => candidate.id === zoneId);
    return zone?.label || t("c.selection.unnamedZone");
  };
  const taskLabel = (title: string | undefined, missing = false) => title?.trim() || t(missing ? "c.selection.missingTask" : "c.selection.untitledTask");
  const unchangedZoneDetails = isZonePreview
    ? preview.unchanged.flatMap((taskId) => {
      const task = useStore.getState().tasks.find((candidate) => candidate.id === taskId);
      if (!task) return [];
      const resolution = selectEffectiveZone(task, useStore.getState().zones);
      return resolution.kind === "assigned" ? [{ id: task.id, title: task.title, zoneId: resolution.zone.id }] : [];
    })
    : [];
  const apply = async () => {
    if (isApplying || !isCurrent) return;
    setIsApplying(true);
    try {
      await onApply();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      ref={root}
      tabIndex={-1}
      role="region"
      aria-label={isZonePreview ? t("c.selection.zonePreviewLabel") : t("c.selection.tidy")}
      className="flex items-center gap-2"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={isApplying}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      {isZonePreview && <span className="text-2xs font-medium text-nc-accent-strong">{t("c.selection.arrangeZones")} · {t("c.selection.zonePreviewScope")}</span>}
      <span className="text-2xs text-nc-accent-strong">
        {t("c.selection.tidyPreview", {
          moved: preview.moved.length,
          unchanged: preview.unchanged.length,
          skipped: preview.skipped.length,
        })}
      </span>
      {Object.entries(skippedByReason).map(([reason, count]) => (
        <span key={reason} className="text-2xs text-nc-warning">
          {t(skipReasonKeys[reason], { count })}
        </span>
      ))}
      {isZonePreview && (preview.moved.length > 0 || preview.skipped.length > 0) && <div className="relative">
        <button type="button" aria-expanded={showZoneDetails} aria-controls="zone-arrangement-details" onClick={() => setShowZoneDetails((shown) => !shown)} className="min-w-11 min-h-11 text-xs px-2 py-1 rounded-nc-sm text-nc-soft hover:text-nc-text hover:bg-nc-fill">{t("c.selection.zoneDetails")}</button>
        {showZoneDetails && <div id="zone-arrangement-details" className="absolute bottom-full left-0 z-10 mb-2 max-h-48 w-72 overflow-auto rounded-nc-sm border border-nc-line bg-nc-well p-2 text-2xs text-nc-text shadow-nc-md">
          {preview.moved.map((move) => <p key={move.id}>{t("c.selection.zoneMovedDetail", { task: taskLabel(move.title), zone: zoneLabel(move.zoneId) })}</p>)}
          {unchangedZoneDetails.map((task) => <p key={task.id}>{t("c.selection.zoneUnchangedDetail", { task: taskLabel(task.title), zone: zoneLabel(task.zoneId) })}</p>)}
          {preview.skipped.map((skipped) => <p key={skipped.id}>{t("c.selection.zoneSkippedDetail", { task: taskLabel(skipped.title, skipped.reason === "missing-task"), reason: t(skipReasonKeys[skipped.reason]) })}</p>)}
        </div>}
      </div>}
      <BarButton label={isZonePreview ? t("c.selection.applyZones") : t("c.selection.applyTidy")} onClick={() => void apply()} disabled={isApplying || !isCurrent} />
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
      className={`min-w-11 min-h-11 text-xs whitespace-nowrap px-2 py-1 rounded-nc-sm transition-colors${
        disabled
          ? "cursor-not-allowed text-nc-faint"
          : danger ? "text-nc-muted hover:text-nc-danger hover:bg-nc-danger-muted" : "text-nc-soft hover:text-nc-text hover:bg-nc-fill"
      }`}
    >
      {label}
    </button>
  );
}
