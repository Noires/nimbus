import { dialogSpring, quickFade } from "../utils/motion";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useT, useLocale } from "../i18n";

// Feature catalog: every capability with a one-line description, grouped.
const GROUPS: Array<{ group: string; features: string[] }> = [
  {
    group: "help.group.canvas",
    features: ["help.cards", "help.lasso", "help.zones", "help.lod", "help.undo"],
  },
  {
    group: "help.group.bubbles",
    features: ["help.bubbles", "help.arrange", "help.xray", "help.split", "help.focus"],
  },
  {
    group: "help.group.planning",
    features: ["help.checklist", "help.deps", "help.recurring", "help.estimates", "help.snooze", "help.inbox", "help.quickadd"],
  },
  {
    group: "help.group.time",
    features: ["help.timelens", "help.gravity", "help.daydock", "help.flowfill", "help.review"],
  },
  {
    group: "help.group.views",
    features: ["help.palette", "help.minimap", "help.spatialnav", "help.ledger", "help.portals", "help.timelapse", "help.pulse"],
  },
  {
    group: "help.group.automation",
    features: ["help.autopilot", "help.github", "help.sharing", "help.export", "help.livewire"],
  },
];

export function HelpPanel({
  onClose,
  onStartTutorial,
}: {
  onClose: () => void;
  onStartTutorial?: () => void;
}) {
  const t = useT();
  const reducedMotion = useReducedMotion();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    queueMicrotask(() => closeRef.current?.focus());
    return () => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
      else document.getElementById("command-center-tutorial-return")?.focus();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center px-4 py-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={quickFade} className="absolute inset-0 bg-nc-scrim" aria-hidden="true" />
      <motion.div
        ref={dialogRef}
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? quickFade : dialogSpring}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-panel-title"
        aria-describedby="help-panel-subtitle"
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-3xl max-h-full rounded-nc-xl bg-nc-raised/95 backdrop-blur-xl border border-nc-line shadow-nc-lg flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-nc-line-faint">
          <div>
            <h2 id="help-panel-title" className="text-base font-semibold text-nc-text">{t("help.title")}</h2>
            <div id="help-panel-subtitle" className="text-2xs text-nc-faint">{t("help.subtitle")}</div>
          </div>
          <div className="flex items-center gap-2">
            {onStartTutorial && (
              <button onClick={onStartTutorial} className="px-2 py-1 rounded-nc-sm text-xs text-nc-accent-strong border border-nc-accent/30 hover:bg-nc-accent/10 transition-colors">
                {t("tutorial.help")}
              </button>
            )}
            <button
              onClick={() => setLocale(locale === "de" ? "en" : "de")}
              className="px-2 py-1 rounded-nc-sm text-xs text-nc-soft border border-nc-line hover:bg-nc-fill transition-colors"
              title={t("lang.toggle")}
            >
              {/* Plain text — Windows renders flag emoji as letter pairs ("DE DE"). */}
              {locale === "de" ? "DE" : "EN"}
            </button>
            <button ref={closeRef} type="button" onClick={onClose} aria-label={t("help.close")} className="text-nc-faint hover:text-nc-text text-lg leading-none px-1">
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          {GROUPS.map(({ group, features }) => (
            <div key={group}>
              <div className="text-2xs uppercase tracking-wider text-nc-accent/80 mb-2">{t(group)}</div>
              <div className="flex flex-col gap-2.5">
                {features.map((key) => (
                  <div key={key}>
                    <div className="text-xs font-medium text-nc-text">{t(`${key}.name`)}</div>
                    <div className="text-2xs text-nc-faint leading-relaxed">
                      {key === "help.inbox" ? t("help.inbox.triage.desc") : t(`${key}.desc`)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
