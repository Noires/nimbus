import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useT } from "../i18n";
import { menuPop, quickFade } from "../utils/motion";
import { useAnchorRect, type AnchorRect } from "../hooks/useAnchorRect";
import { GUIDED_TOUR_STEPS } from "./guidedTourSteps";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { ContourMark } from "./ui/icons";
import { MOBILE_COMMAND_CENTER_QUERY } from "./mobileCommandDestination";

/* The guided tour points at the REAL interface, one element at a time: a
 * spotlight ring over the live anchor plus a positioned tooltip card. It is
 * strictly read-only — the full-viewport interceptor keeps the app inert
 * while the tour is open, so nothing can be read, clicked, or changed. */

export const COMMAND_CENTER_TUTORIAL_KEY = "nimbus:guided-tour-v1";
const LEGACY_TUTORIAL_KEY = "nimbus:command-center-tutorial-v6";
const TOUR_VERSION = 1;
export type TutorialStatus = "in-progress" | "completed" | "skipped";
type TourProgress = { version: number; status: TutorialStatus; step: number };

function normalizedStep(step: unknown): number {
  return typeof step === "number" ? Math.max(0, Math.min(GUIDED_TOUR_STEPS.length - 1, Math.floor(step))) : 0;
}

/** Reads only tour-owned local data; also clears the retired sample-modal
 * checkpoint so previous users see the new tour offer once. */
export function readCommandCenterTutorial(): TourProgress | null {
  try {
    window.localStorage.removeItem(LEGACY_TUTORIAL_KEY);
    const raw = window.localStorage.getItem(COMMAND_CENTER_TUTORIAL_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<TourProgress>;
    if (value.version !== TOUR_VERSION || !["in-progress", "completed", "skipped"].includes(value.status ?? "")) return null;
    return { version: TOUR_VERSION, status: value.status as TutorialStatus, step: normalizedStep(value.step) };
  } catch { return null; }
}

function writeProgress(progress: TourProgress) {
  try { window.localStorage.setItem(COMMAND_CENTER_TUTORIAL_KEY, JSON.stringify(progress)); } catch { /* Local storage is optional. */ }
}

function newProgress(): TourProgress {
  return { version: TOUR_VERSION, status: "in-progress", step: 0 };
}

const CARD_WIDTH = 352; // px — matches min(22rem, …) for placement math
const CARD_MARGIN = 12;

function placeCard(rect: AnchorRect | null): { top: number; left: number } | null {
  if (!rect || typeof window === "undefined") return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const estimatedHeight = 220;
  const spaceRight = vw - (rect.left + rect.width);
  const spaceLeft = rect.left;
  const spaceBottom = vh - (rect.top + rect.height);
  let top: number;
  let left: number;
  if (spaceRight >= CARD_WIDTH + CARD_MARGIN * 2) {
    left = rect.left + rect.width + CARD_MARGIN;
    top = rect.top;
  } else if (spaceLeft >= CARD_WIDTH + CARD_MARGIN * 2) {
    left = rect.left - CARD_WIDTH - CARD_MARGIN;
    top = rect.top;
  } else if (spaceBottom >= estimatedHeight + CARD_MARGIN * 2) {
    left = rect.left;
    top = rect.top + rect.height + CARD_MARGIN;
  } else {
    left = rect.left;
    top = rect.top - estimatedHeight - CARD_MARGIN;
  }
  return {
    top: Math.max(CARD_MARGIN, Math.min(top, vh - estimatedHeight - CARD_MARGIN)),
    left: Math.max(CARD_MARGIN, Math.min(left, vw - CARD_WIDTH - CARD_MARGIN)),
  };
}

export function CommandCenterTutorial({ open, onClose, replay = false, onStatusChange }: {
  open: boolean;
  onClose: () => void;
  replay?: boolean;
  onStatusChange?: (status: TutorialStatus) => void;
}) {
  const t = useT();
  const reduced = useReducedMotion();
  // Desktop-only: none of the anchors exist in the mobile companion. Uses the
  // router's mobile query (false fallback) so SSR/static renders show the tour.
  const desktop = !useMediaQuery(MOBILE_COMMAND_CENTER_QUERY, false);
  const [progress, setProgress] = useState<TourProgress>(newProgress);
  const directionRef = useRef<1 | -1>(1);
  const dialogRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const step = GUIDED_TOUR_STEPS[normalizedStep(progress.step)];
  const { rect } = useAnchorRect(open && desktop ? step.selectors : null);

  const restoreFocus = () => {
    const opener = openerRef.current;
    if (opener?.isConnected && opener !== document.body) opener.focus();
    else document.getElementById("command-center-tutorial-return")?.focus();
  };

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const saved = readCommandCenterTutorial();
    const next = replay || saved?.status !== "in-progress" ? newProgress() : { ...saved, status: "in-progress" as const };
    directionRef.current = 1;
    setProgress(next);
    if (replay) {
      writeProgress(next);
      onStatusChange?.(next.status);
    }
    return () => { restoreFocus(); };
  }, [open, replay, onStatusChange]);

  useEffect(() => {
    if (open) queueMicrotask(() => titleRef.current?.focus());
  }, [open, progress.step]);

  // Auto-skip optional steps whose anchor is missing, in the direction of
  // travel. The check queries the DOM directly inside a per-step timeout —
  // no state pairing, so a reopen can never see stale measurement state. The
  // delay outlasts entrance animations (rail slides in over .22s).
  useEffect(() => {
    if (!open || !desktop || step.selectors.length === 0 || !step.optional) return;
    const timer = setTimeout(() => {
      const anchored = step.selectors.some((selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      });
      if (anchored) return;
      const next = progress.step + directionRef.current;
      if (next < 0 || next >= GUIDED_TOUR_STEPS.length) return;
      setProgress((current) => ({ ...current, step: normalizedStep(next) }));
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, desktop, progress.step, step]);

  if (!open || !desktop) return null;

  const save = (next: TourProgress) => { setProgress(next); writeProgress(next); };
  const close = (status: TutorialStatus) => {
    writeProgress({ ...progress, status });
    onStatusChange?.(status);
    restoreFocus();
    onClose();
  };
  const go = (target: number, direction: 1 | -1) => {
    directionRef.current = direction;
    save({ ...progress, status: "in-progress", step: normalizedStep(target) });
  };
  const next = () => (progress.step === GUIDED_TOUR_STEPS.length - 1 ? close("completed") : go(progress.step + 1, 1));
  const back = () => go(progress.step - 1, -1);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Keep every key local: CanvasRouter owns global shortcuts (N, Z, Space…).
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close("in-progress");
      return;
    }
    if (event.key === "ArrowRight") { event.preventDefault(); next(); return; }
    if (event.key === "ArrowLeft" && progress.step > 0) { event.preventDefault(); back(); return; }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const centered = step.selectors.length === 0 || rect === null;
  const spotlight = centered ? null : {
    top: rect!.top - step.padding,
    left: rect!.left - step.padding,
    width: rect!.width + step.padding * 2,
    height: rect!.height + step.padding * 2,
  };
  const cardPosition = centered ? null : placeCard(spotlight);
  const isLast = progress.step === GUIDED_TOUR_STEPS.length - 1;
  const showPromise = step.id === "welcome" || step.id === "finish";

  return (
    <div className="guided-tour" role="presentation" onKeyDown={handleKeyDown}>
      {centered ? (
        <motion.div className="guided-tour__backdrop" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={reduced ? { duration: 0 } : quickFade} />
      ) : (
        <motion.div
          key={progress.step}
          className="guided-tour__spotlight"
          aria-label={t("tutorial.spotlightAria")}
          role="presentation"
          style={spotlight!}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? { duration: 0 } : quickFade}
        />
      )}
      <motion.section
        key={`card-${progress.step}`}
        ref={dialogRef}
        className={`guided-tour__card${centered ? " guided-tour__card--centered" : ""}`}
        style={cardPosition ?? undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-center-tutorial-title"
        aria-describedby="command-center-tutorial-description"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={reduced ? quickFade : menuPop}
      >
        <p className="guided-tour__eyebrow">{t("tutorial.tourLabel")}</p>
        <h2 ref={titleRef} tabIndex={-1} id="command-center-tutorial-title">{t(`tutorial.${step.id}.title`)}</h2>
        <p id="command-center-tutorial-description">{t(`tutorial.${step.id}.body`)}</p>
        {showPromise && <p className="guided-tour__promise" aria-live="polite">{t("tutorial.isolation")}</p>}
        <footer className="guided-tour__actions">
          <span aria-live="polite">{t("tutorial.progress", { current: progress.step + 1, total: GUIDED_TOUR_STEPS.length })}</span>
          <div>
            {progress.step > 0 && <button type="button" onClick={back}>{t("tutorial.back")}</button>}
            <button type="button" aria-label={t("tutorial.exitAria")} onClick={() => close("skipped")}>{t("tutorial.skip")}</button>
            <button type="button" className="command-center-tutorial__primary" onClick={next}>{isLast ? t("tutorial.finish") : t("tutorial.next")}</button>
          </div>
        </footer>
      </motion.section>
    </div>
  );
}

export function CommandCenterTutorialOffer({ onStart }: { onStart: () => void }) {
  const t = useT();
  const [progress, setProgress] = useState<TourProgress | null>(() => readCommandCenterTutorial());
  if (progress?.status === "completed" || progress?.status === "skipped") return null;
  const resume = progress?.status === "in-progress";
  return <aside className="command-center-tutorial-offer nc-chart-wash" aria-label={t("tutorial.offerAria")}>
    <span className="night-cartography__ornament" aria-hidden="true"><ContourMark size={128} /></span>
    <strong>{t(resume ? "tutorial.resumeTitle" : "tutorial.offerTitle")}</strong><p>{t("tutorial.offerBody")}</p>
    <button type="button" className="command-center-tutorial__primary" onClick={() => { const next = progress ?? newProgress(); writeProgress(next); setProgress(next); onStart(); }}>{t(resume ? "tutorial.resume" : "tutorial.start")}</button>
    <button type="button" onClick={() => { const next = { ...(progress ?? newProgress()), status: "skipped" as const }; writeProgress(next); setProgress(next); }}>{t("tutorial.notNow")}</button>
  </aside>;
}

export function resetCommandCenterTutorial() {
  try {
    window.localStorage.removeItem(COMMAND_CENTER_TUTORIAL_KEY);
    window.localStorage.removeItem(LEGACY_TUTORIAL_KEY);
  } catch { /* no-op */ }
}
