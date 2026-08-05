import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useStore, type CanvasSettings } from "../store";
import { api } from "../data/api";
import { ensureNotifyPermission } from "../utils/notifications";
import { useT } from "../i18n";
import { MenuPanel } from "./toolbarMenu";

// Curated automation switches — deliberately not a rules engine. Server-side
// actions run as actor "autopilot" so history and time-lapse stay honest.
export function AutopilotPopover({ canvasId }: { canvasId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
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

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (open) requestAnimationFrame(() => initialFocusRef.current?.focus());
  }, [open]);

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), select:not([disabled])") ?? []);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div role="none" className="relative">
      <button
        ref={triggerRef}
        role="menuitem"
        onClick={() => (open ? close() : setOpen(true))}
        className={`w-7 h-7 rounded-nc-sm text-sm transition-colors ${
          open ? "bg-nc-fill text-nc-text" : "text-nc-muted hover:text-nc-text"
        }`}
        title={t("a.autopilot.title")}
      >
        <span aria-hidden="true">⚙</span>
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <MenuPanel ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("a.autopilot.title")} onKeyDown={trapFocus} className="absolute right-4 top-16 z-50 w-72 rounded-nc-lg bg-nc-raised/95 backdrop-blur-md border border-nc-line shadow-nc-lg p-3 flex flex-col gap-2.5">
            <span className="rail-section__label rail-section__label--inline">{t("a.autopilot.header")}</span>

            <Switch
              label={t("a.autopilot.autoComplete")}
              checked={settings.autoCompleteChecklist === true}
              onChange={(v) => void save({ autoCompleteChecklist: v })}
              buttonRef={initialFocusRef}
            />
            <label className="flex items-center justify-between gap-2">
              <span className="text-xs text-nc-soft">{t("a.autopilot.autoArchive")}</span>
              <select
                value={settings.autoArchiveDays ?? 0}
                onChange={(e) => void save({ autoArchiveDays: Number(e.target.value) || undefined })}
                className="bg-nc-well border border-nc-line-faint rounded-nc-sm px-1.5 py-0.5 text-xs text-nc-soft"
              >
                <option value={0}>{t("a.autopilot.never")}</option>
                <option value={3}>{t("a.autopilot.days", { count: 3 })}</option>
                <option value={7}>{t("a.autopilot.days", { count: 7 })}</option>
                <option value={14}>{t("a.autopilot.days", { count: 14 })}</option>
                <option value={30}>{t("a.autopilot.days", { count: 30 })}</option>
              </select>
            </label>

            <div className="h-px bg-nc-fill" />
            <span className="rail-section__label rail-section__label--inline">{t("a.autopilot.notifications")}</span>

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
            <label className="flex items-center justify-between gap-2">
              <span className="text-xs text-nc-soft">{t("a.autopilot.digest")}</span>
              <select
                value={settings.digestHour ?? -1}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  void save({ digestHour: v < 0 ? null : v });
                }}
                className="bg-nc-well border border-nc-line-faint rounded-nc-sm px-1.5 py-0.5 text-xs text-nc-soft"
              >
                <option value={-1}>{t("a.autopilot.off")}</option>
                {[7, 8, 9, 10, 12, 16].map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </label>
            <span className="text-2xs text-nc-muted">
              {t("a.autopilot.footnote")}
            </span>
          </MenuPanel>
        </>, document.body)}
    </div>
  );
}

function Switch({ label, checked, onChange, buttonRef }: { label: string; checked: boolean; onChange: (v: boolean) => void; buttonRef?: React.RefObject<HTMLButtonElement | null> }) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer">
      <span className="text-xs text-nc-soft">{label}</span>
      <button
        ref={buttonRef}
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-8 h-4.5 rounded-full transition-colors relative shrink-0 ${
          checked ? "bg-nc-accent-surface" : "bg-nc-fill"
        }`}
        style={{ height: 18 }}
      >
        <span
          className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-nc-text transition-all"
          style={{ left: checked ? 16 : 2 }}
        />
      </button>
    </label>
  );
}
