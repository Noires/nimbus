import { motion } from "framer-motion";
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

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        className="relative w-full max-w-3xl max-h-full rounded-xl bg-[#12141a]/98 backdrop-blur-xl border border-white/15 shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div>
            <h2 className="text-base font-semibold text-gray-100">{t("help.title")}</h2>
            <div className="text-[11px] text-gray-500">{t("help.subtitle")}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocale(locale === "de" ? "en" : "de")}
              className="px-2 py-1 rounded-md text-xs text-gray-300 border border-white/15 hover:bg-white/10 transition-colors"
              title={t("lang.toggle")}
            >
              {locale === "de" ? "🇩🇪 DE" : "🇬🇧 EN"}
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-lg leading-none px-1">
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          {GROUPS.map(({ group, features }) => (
            <div key={group}>
              <div className="text-[10px] uppercase tracking-wider text-cyan-400/80 mb-2">{t(group)}</div>
              <div className="flex flex-col gap-2.5">
                {features.map((key) => (
                  <div key={key}>
                    <div className="text-xs font-medium text-gray-200">{t(`${key}.name`)}</div>
                    <div className="text-[11px] text-gray-500 leading-relaxed">{t(`${key}.desc`)}</div>
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
