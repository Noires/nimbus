import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useT } from "../i18n";

export const COMMAND_CENTER_TUTORIAL_KEY = "nimbus:command-center-tutorial-v1";

type TutorialStatus = "offered" | "completed" | "skipped";

function readStatus(): TutorialStatus | null {
  try {
    const value = window.localStorage.getItem(COMMAND_CENTER_TUTORIAL_KEY);
    return value === "offered" || value === "completed" || value === "skipped" ? value : null;
  } catch {
    return null;
  }
}

function writeStatus(status: TutorialStatus) {
  try {
    window.localStorage.setItem(COMMAND_CENTER_TUTORIAL_KEY, status);
  } catch {
    // Privacy and availability: a blocked local store must not prevent use.
  }
}

const STEPS = ["welcome", "capture", "triage", "today", "workstream", "complete", "review"] as const;

/** A client-only, fixture-based walkthrough. It intentionally has no store or API dependency. */
export function CommandCenterTutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const current = STEPS[step];

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setStep(0);
    closeButton.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus();
      else document.getElementById("command-center-tutorial-return")?.focus();
    };
  }, [open]);

  if (!open) return null;
  const finish = (status: TutorialStatus) => {
    writeStatus(status);
    onClose();
  };
  const advance = () => {
    if (step === STEPS.length - 1) finish("completed");
    else setStep((value) => value + 1);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { finish("skipped"); return; }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <div className="command-center-tutorial-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="command-center-tutorial"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-center-tutorial-title"
        aria-describedby="command-center-tutorial-description"
        onKeyDown={handleKeyDown}
      >
        <header className="command-center-tutorial__header">
          <div>
            <p className="command-center-tutorial__eyebrow">{t("tutorial.sampleLabel")}</p>
            <h2 id="command-center-tutorial-title">{t(`tutorial.${current}.title`)}</h2>
          </div>
          <button ref={closeButton} type="button" onClick={() => finish("skipped")} aria-label={t("tutorial.exitAria")}>
            {t("tutorial.exit")}
          </button>
        </header>
        <div className="command-center-tutorial__sample" aria-label={t("tutorial.sampleCanvasAria")}>
          <span className="command-center-tutorial__sample-badge">{t("tutorial.sampleLabel")}</span>
          <div className="command-center-tutorial__sample-card">{t(`tutorial.${current}.sample`)}</div>
        </div>
        <p id="command-center-tutorial-description">{t(`tutorial.${current}.body`)}</p>
        <p className="command-center-tutorial__privacy" aria-live="polite">{t("tutorial.isolation")}</p>
        <footer className="command-center-tutorial__actions">
          <span aria-live="polite">{t("tutorial.progress", { current: step + 1, total: STEPS.length })}</span>
          <div>
            {step > 0 && <button type="button" onClick={() => setStep((value) => value - 1)}>{t("tutorial.back")}</button>}
            <button type="button" onClick={() => finish("skipped")}>{t("tutorial.skip")}</button>
            <button type="button" className="command-center-tutorial__primary" onClick={advance}>
              {step === STEPS.length - 1 ? t("tutorial.finish") : t("tutorial.next")}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export function CommandCenterTutorialOffer({ onStart }: { onStart: () => void }) {
  const t = useT();
  const [visible, setVisible] = useState(() => readStatus() === null);
  if (!visible) return null;
  return (
    <aside className="command-center-tutorial-offer" aria-label={t("tutorial.offerAria")}>
      <strong>{t("tutorial.offerTitle")}</strong>
      <p>{t("tutorial.offerBody")}</p>
      <button type="button" className="command-center-tutorial__primary" onClick={() => { writeStatus("offered"); setVisible(false); onStart(); }}>{t("tutorial.start")}</button>
      <button type="button" onClick={() => { writeStatus("skipped"); setVisible(false); }}>{t("tutorial.notNow")}</button>
    </aside>
  );
}

export function resetCommandCenterTutorial() {
  try { window.localStorage.removeItem(COMMAND_CENTER_TUTORIAL_KEY); } catch { /* no-op */ }
}
