import { useState } from "react";
import { useStore, type CanvasSettings } from "../store";
import { api } from "../data/api";
import { ensureNotifyPermission } from "../utils/notifications";
import { useT } from "../i18n";

// Curated automation switches — deliberately not a rules engine. Server-side
// actions run as actor "autopilot" so history and time-lapse stay honest.
export function AutopilotPopover({ canvasId }: { canvasId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const canvases = useStore((s) => s.canvases);
  const canvas = canvases.find((c) => c.id === canvasId);
  const settings: CanvasSettings = (canvas?.settings as CanvasSettings) ?? {};

  const save = async (patch: Partial<CanvasSettings>) => {
    try {
      const next = { ...settings, ...patch };
      if (patch.notifyUnblocked || patch.notifyWake || patch.digestHour != null) {
        await ensureNotifyPermission();
      }
      const saved = await api.updateCanvas(canvasId, { settings: next });
      useStore.setState({
        canvases: useStore.getState().canvases.map((c) => (c.id === canvasId ? saved : c)),
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`w-7 h-7 rounded-md text-sm transition-colors ${
          open ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
        }`}
        title={t("a.autopilot.title")}
      >
        ⚙
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-72 rounded-xl bg-[#1a1d24]/98 border border-white/15 shadow-2xl p-3 flex flex-col gap-2.5">
            <span className="text-[10px] uppercase tracking-wider text-gray-600">{t("a.autopilot.header")}</span>

            <Switch
              label={t("a.autopilot.autoComplete")}
              checked={settings.autoCompleteChecklist === true}
              onChange={(v) => void save({ autoCompleteChecklist: v })}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-300">{t("a.autopilot.autoArchive")}</span>
              <select
                value={settings.autoArchiveDays ?? 0}
                onChange={(e) => void save({ autoArchiveDays: Number(e.target.value) || undefined })}
                className="bg-[#0f0f13] border border-white/10 rounded px-1.5 py-0.5 text-xs text-gray-300"
              >
                <option value={0}>{t("a.autopilot.never")}</option>
                <option value={3}>{t("a.autopilot.days", { count: 3 })}</option>
                <option value={7}>{t("a.autopilot.days", { count: 7 })}</option>
                <option value={14}>{t("a.autopilot.days", { count: 14 })}</option>
                <option value={30}>{t("a.autopilot.days", { count: 30 })}</option>
              </select>
            </div>

            <div className="h-px bg-white/10" />
            <span className="text-[10px] uppercase tracking-wider text-gray-600">{t("a.autopilot.notifications")}</span>

            <Switch
              label={t("a.autopilot.notifyUnblocked")}
              checked={settings.notifyUnblocked === true}
              onChange={(v) => void save({ notifyUnblocked: v })}
            />
            <Switch
              label={t("a.autopilot.notifyWake")}
              checked={settings.notifyWake === true}
              onChange={(v) => void save({ notifyWake: v })}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-300">{t("a.autopilot.digest")}</span>
              <select
                value={settings.digestHour ?? -1}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  void save({ digestHour: v < 0 ? null : v });
                }}
                className="bg-[#0f0f13] border border-white/10 rounded px-1.5 py-0.5 text-xs text-gray-300"
              >
                <option value={-1}>{t("a.autopilot.off")}</option>
                {[7, 8, 9, 10, 12, 16].map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </div>
            <span className="text-[9px] text-gray-600">
              {t("a.autopilot.footnote")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer">
      <span className="text-xs text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-8 h-4.5 rounded-full transition-colors relative shrink-0 ${
          checked ? "bg-purple-600" : "bg-white/10"
        }`}
        style={{ height: 18 }}
      >
        <span
          className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all"
          style={{ left: checked ? 16 : 2 }}
        />
      </button>
    </label>
  );
}
