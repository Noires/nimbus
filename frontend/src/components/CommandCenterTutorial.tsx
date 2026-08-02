import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useT } from "../i18n";

export const COMMAND_CENTER_TUTORIAL_KEY = "nimbus:command-center-tutorial-v2";
const TUTORIAL_VERSION = 2;
const STEPS = ["welcome", "capture", "triage", "today", "workstream", "complete", "review"] as const;
type TutorialStep = typeof STEPS[number];
type TutorialStatus = "in-progress" | "completed" | "skipped";
type SampleState = { captured: boolean; triaged: boolean; today: boolean; completed: boolean };
type TutorialProgress = { version: number; status: TutorialStatus; step: number; sample: SampleState };
const INITIAL_SAMPLE: SampleState = { captured: false, triaged: false, today: false, completed: false };

function normalizedStep(step: unknown): number {
  return typeof step === "number" ? Math.max(0, Math.min(STEPS.length - 1, Math.floor(step))) : 0;
}

/** Reads only tutorial-owned local data. It never consults the Nimbus store or API. */
export function readCommandCenterTutorial(): TutorialProgress | null {
  try {
    const raw = window.localStorage.getItem(COMMAND_CENTER_TUTORIAL_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<TutorialProgress>;
    if (value.version !== TUTORIAL_VERSION || !["in-progress", "completed", "skipped"].includes(value.status ?? "")) return null;
    const sample = value.sample;
    if (!sample || typeof sample.captured !== "boolean" || typeof sample.triaged !== "boolean" || typeof sample.today !== "boolean" || typeof sample.completed !== "boolean") return null;
    return { version: TUTORIAL_VERSION, status: value.status as TutorialStatus, step: normalizedStep(value.step), sample };
  } catch { return null; }
}

function writeProgress(progress: TutorialProgress) {
  try { window.localStorage.setItem(COMMAND_CENTER_TUTORIAL_KEY, JSON.stringify(progress)); } catch { /* Local storage is optional. */ }
}

function newProgress(): TutorialProgress {
  return { version: TUTORIAL_VERSION, status: "in-progress", step: 0, sample: { ...INITIAL_SAMPLE } };
}

function actionComplete(step: TutorialStep, sample: SampleState): boolean {
  if (step === "capture") return sample.captured;
  if (step === "triage") return sample.triaged;
  if (step === "today") return sample.today;
  if (step === "complete") return sample.completed;
  return true;
}

/**
 * A client-only, deterministic sample Canvas. Every record is contained in this
 * component's tutorial-local state and optional localStorage checkpoint: no
 * productive task, workstream, canvas, zone, setting, or history can be read or mutated.
 */
export function CommandCenterTutorial({ open, onClose, replay = false }: { open: boolean; onClose: () => void; replay?: boolean }) {
  const t = useT();
  const [progress, setProgress] = useState<TutorialProgress>(newProgress);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const current = STEPS[progress.step];

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const saved = readCommandCenterTutorial();
    const next = replay || saved?.status !== "in-progress" ? newProgress() : saved;
    setProgress(next);
    if (replay) writeProgress(next);
    queueMicrotask(() => closeButton.current?.focus());
    return () => {
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus();
      else document.getElementById("command-center-tutorial-return")?.focus();
    };
  }, [open, replay]);

  if (!open) return null;
  const save = (next: TutorialProgress) => { setProgress(next); writeProgress(next); };
  const close = (status: TutorialStatus) => { writeProgress({ ...progress, status }); onClose(); };
  const go = (step: number) => save({ ...progress, status: "in-progress", step: normalizedStep(step) });
  const performSampleAction = () => {
    const sample = current === "capture" ? { ...progress.sample, captured: true }
      : current === "triage" ? { ...progress.sample, captured: true, triaged: true }
        : current === "today" ? { ...progress.sample, captured: true, triaged: true, today: true }
          : current === "complete" ? { ...progress.sample, captured: true, triaged: true, today: true, completed: true }
            : progress.sample;
    save({ ...progress, status: "in-progress", sample });
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { close("in-progress"); return; }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusable?.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const needsAction = ["capture", "triage", "today", "complete"].includes(current);
  const complete = actionComplete(current, progress.sample);

  return <div className="command-center-tutorial-backdrop" role="presentation">
    <section ref={dialogRef} className="command-center-tutorial" role="dialog" aria-modal="true" aria-labelledby="command-center-tutorial-title" aria-describedby="command-center-tutorial-description" onKeyDown={handleKeyDown}>
      <header className="command-center-tutorial__header">
        <div><p className="command-center-tutorial__eyebrow">{t("tutorial.sampleLabel")}</p><h2 id="command-center-tutorial-title">{t(`tutorial.${current}.title`)}</h2></div>
        <button ref={closeButton} type="button" onClick={() => close("in-progress")} aria-label={t("tutorial.exitAria")}>{t("tutorial.exit")}</button>
      </header>
      <div className="command-center-tutorial__sample" aria-label={t("tutorial.sampleCanvasAria")}>
        <span className="command-center-tutorial__sample-badge">{t("tutorial.sampleLabel")}</span>
        <div className="command-center-tutorial__sample-card">{t(`tutorial.${current}.sample`)}</div>
        <p className="command-center-tutorial__privacy" aria-live="polite">{t("tutorial.isolation")}</p>
        {needsAction && <button type="button" className="command-center-tutorial__primary" onClick={performSampleAction}>{complete ? t("tutorial.actionDone") : t(`tutorial.${current}.action`)}</button>}
      </div>
      <p id="command-center-tutorial-description">{t(`tutorial.${current}.body`)}</p>
      <footer className="command-center-tutorial__actions">
        <span aria-live="polite">{t("tutorial.progress", { current: progress.step + 1, total: STEPS.length })}</span>
        <div>
          {progress.step > 0 && <button type="button" onClick={() => go(progress.step - 1)}>{t("tutorial.back")}</button>}
          <button type="button" onClick={() => save(newProgress())}>{t("tutorial.reset")}</button>
          <button type="button" onClick={() => close("skipped")}>{t("tutorial.skip")}</button>
          <button type="button" className="command-center-tutorial__primary" disabled={!complete} onClick={() => progress.step === STEPS.length - 1 ? close("completed") : go(progress.step + 1)}>{progress.step === STEPS.length - 1 ? t("tutorial.finish") : t("tutorial.next")}</button>
        </div>
      </footer>
    </section>
  </div>;
}

export function CommandCenterTutorialOffer({ onStart }: { onStart: () => void }) {
  const t = useT();
  const [progress, setProgress] = useState<TutorialProgress | null>(() => readCommandCenterTutorial());
  if (progress?.status === "completed" || progress?.status === "skipped") return null;
  const resume = progress?.status === "in-progress";
  return <aside className="command-center-tutorial-offer" aria-label={t("tutorial.offerAria")}>
    <strong>{t(resume ? "tutorial.resumeTitle" : "tutorial.offerTitle")}</strong><p>{t("tutorial.offerBody")}</p>
    <button type="button" className="command-center-tutorial__primary" onClick={() => { const next = progress ?? newProgress(); writeProgress(next); setProgress(next); onStart(); }}>{t(resume ? "tutorial.resume" : "tutorial.start")}</button>
    <button type="button" onClick={() => { const next = { ...(progress ?? newProgress()), status: "skipped" as const }; writeProgress(next); setProgress(next); }}>{t("tutorial.notNow")}</button>
  </aside>;
}

export function resetCommandCenterTutorial() {
  try { window.localStorage.removeItem(COMMAND_CENTER_TUTORIAL_KEY); } catch { /* no-op */ }
}
