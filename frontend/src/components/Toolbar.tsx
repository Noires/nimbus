import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Template } from "../data/api";
import { useStore, CARD_W, CARD_H, type LensMode } from "../store";
import { exportCsv, exportJson, exportMarkdown, pickJsonFile } from "../utils/exporters";
import { startReview } from "./ReviewMode";
import { AutopilotPopover } from "./AutopilotPopover";
import { OrbitPopover } from "./OrbitPopover";
import { ConnectionsModal } from "./ConnectionsModal";
import { useLocale, useT } from "../i18n";

interface ToolbarProps {
  canvasId: string;
  onAddTask: () => void;
  onOpenTimelapse: () => void;
  onOpenPulse: () => void;
}

const LENSES: Array<{ mode: LensMode; labelKey: string; titleKey: string }> = [
  { mode: "time", labelKey: "a.toolbar.lens.time", titleKey: "a.toolbar.lens.timeTitle" },
  { mode: "gravity", labelKey: "a.toolbar.lens.gravity", titleKey: "a.toolbar.lens.gravityTitle" },
  { mode: "heat", labelKey: "a.toolbar.lens.heat", titleKey: "a.toolbar.lens.heatTitle" },
];

export function Toolbar({ canvasId, onAddTask, onOpenTimelapse, onOpenPulse }: ToolbarProps) {
  const tasks = useStore((s) => s.tasks);
  const showDone = useStore((s) => s.showDone);
  const toggleShowDone = useStore((s) => s.toggleShowDone);
  const showArchived = useStore((s) => s.showArchived);
  const toggleShowArchived = useStore((s) => s.toggleShowArchived);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const lens = useStore((s) => s.lens);
  const setLens = useStore((s) => s.setLens);
  const canvases = useStore((s) => s.canvases);
  const bubbles = useStore((s) => s.bubbles);
  const liveConnected = useStore((s) => s.liveConnected);
  const connections = useStore((s) => s.connections);
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const connectionError = connections.find((c) => c.status === "error");
  const [templates, setTemplates] = useState<Template[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (menuOpen) {
      api.listTemplates().then(setTemplates).catch(() => setTemplates([]));
    }
  }, [menuOpen]);

  const canvas = canvases.find((c) => c.id === canvasId);
  const canvasName = canvas?.name ?? "canvas";

  const copyTokenUrl = async (kind: "share" | "ics" | "capture") => {
    setMenuOpen(false);
    try {
      let token =
        kind === "share" ? canvas?.shareToken : kind === "ics" ? canvas?.icsToken : canvas?.captureToken;
      if (!token) {
        const saved = await api.mintToken(canvasId, kind);
        useStore.setState({
          canvases: useStore.getState().canvases.map((c) => (c.id === canvasId ? saved : c)),
        });
        token = kind === "share" ? saved.shareToken : kind === "ics" ? saved.icsToken : saved.captureToken;
      }
      const url =
        kind === "share"
          ? `${location.origin}/share/${token}`
          : kind === "ics"
            ? `${location.origin}/api/feeds/${token}.ics`
            : `${location.origin}/api/capture/${token}`;
      await navigator.clipboard.writeText(url);
      useStore.getState().showToast(
        kind === "share"
          ? t("a.toolbar.toast.shareCopied")
          : kind === "ics"
            ? t("a.toolbar.toast.icsCopied")
            : t("a.toolbar.toast.captureCopied"),
      );
    } catch (e) {
      console.error(e);
      useStore.getState().showToast(t("a.toolbar.toast.mintFailed"));
    }
  };

  const revokeShare = async () => {
    setMenuOpen(false);
    try {
      const saved = await api.revokeToken(canvasId, "share");
      useStore.setState({
        canvases: useStore.getState().canvases.map((c) => (c.id === canvasId ? saved : c)),
      });
      useStore.getState().showToast(t("a.toolbar.toast.shareRevoked"));
    } catch (e) {
      console.error(e);
    }
  };

  const viewportCenterWorld = () => {
    const { zoom, panX, panY, viewportW, viewportH } = useStore.getState();
    return { x: (viewportW / 2 - panX) / zoom, y: (viewportH / 2 - panY) / zoom };
  };

  const stampTemplate = async (template: Template) => {
    setMenuOpen(false);
    const store = useStore.getState();
    try {
      const center = viewportCenterWorld();
      const { tasks: created, title } = await api.instantiateTemplate(
        template.id,
        canvasId,
        center.x,
        center.y,
      );
      await store.refreshTasks(canvasId);
      if (created.length >= 2) {
        await api.createBubble({ canvasId, title, memberIds: created.map((t) => t.id) });
        await store.loadBubbles(canvasId);
      }
      const cx = created.reduce((s, t) => s + t.x + CARD_W / 2, 0) / created.length;
      const cy = created.reduce((s, t) => s + t.y + CARD_H / 2, 0) / created.length;
      store.flyTo(cx, cy, 0.85);
      store.showToast(t("a.toolbar.toast.stamped", { name: template.name, count: created.length }));
    } catch (e) {
      console.error(e);
      store.showToast(t("a.toolbar.toast.stampFailed"));
    }
  };

  const importJson = async () => {
    setMenuOpen(false);
    const payload = await pickJsonFile();
    if (!payload) return;
    try {
      const canvas = await api.importCanvas(payload);
      await useStore.getState().loadCanvases();
      navigate(`/canvas/${canvas.id}`);
      useStore.getState().showToast(t("a.toolbar.toast.imported", { name: canvas.name }));
    } catch (e) {
      console.error(e);
      useStore.getState().showToast(t("a.toolbar.toast.importFailed"));
    }
  };

  const addPortal = async (targetCanvasId: string) => {
    setMenuOpen(false);
    const center = viewportCenterWorld();
    try {
      await useStore.getState().addPortal(canvasId, targetCanvasId, center.x, center.y);
    } catch (e) {
      console.error(e);
    }
  };

  const activeCount = tasks.filter((t) => !t.archivedAt && !t.done && !t.inbox).length;
  const doneCount = tasks.filter((t) => !t.archivedAt && t.done && !t.inbox).length;
  const archivedCount = tasks.filter((t) => t.archivedAt).length;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-xl bg-[#1a1d24]/90 backdrop-blur-md border border-white/10 px-3 py-2 shadow-xl max-w-[95%] flex-wrap justify-center">
      <button
        onClick={onAddTask}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-purple-600/70 hover:bg-purple-600 transition-colors text-white text-xs font-medium shrink-0"
        title={t("a.toolbar.addTitle")}
      >
        <span className="text-base leading-none">+</span> {t("a.toolbar.add")}
      </button>

      <div className="w-px h-6 bg-white/10" />

      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setSearchQuery("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={t("a.toolbar.searchPlaceholder")}
        className="w-36 h-8 px-2.5 rounded-lg bg-[#0f0f13]/60 border border-white/10 focus:border-purple-500 text-xs transition-colors outline-none"
      />

      <div className="w-px h-6 bg-white/10" />

      <span className="text-xs text-gray-400 px-1 whitespace-nowrap">
        {t("a.toolbar.active")} <span className="text-gray-200">{activeCount}</span>
      </span>

      <button
        onClick={toggleShowDone}
        className={`px-2 py-1 rounded-md text-xs transition-colors whitespace-nowrap ${
          showDone ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
        }`}
        title={showDone ? t("a.toolbar.hideDone") : t("a.toolbar.showDone")}
      >
        {t("a.toolbar.done")} {doneCount}
      </button>

      <button
        onClick={toggleShowArchived}
        className={`px-2 py-1 rounded-md text-xs transition-colors whitespace-nowrap ${
          showArchived ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
        }`}
        title={showArchived ? t("a.toolbar.hideArchived") : t("a.toolbar.showArchived")}
      >
        {t("a.toolbar.arch")} {archivedCount}
      </button>

      <OrbitPopover />

      <div className="w-px h-6 bg-white/10" />

      {/* Lenses */}
      {LENSES.map(({ mode, labelKey, titleKey }) => (
        <button
          key={mode}
          onClick={() => setLens(lens === mode ? "off" : mode)}
          className={`px-2 py-1 rounded-md text-xs transition-colors whitespace-nowrap ${
            lens === mode ? "bg-cyan-500/20 text-cyan-300" : "text-gray-400 hover:text-gray-200"
          }`}
          title={t(titleKey)}
        >
          {t(labelKey)}
        </button>
      ))}

      <div className="w-px h-6 bg-white/10" />

      <button
        onClick={() => void useStore.getState().undo()}
        className="w-7 h-7 rounded-md text-gray-400 hover:text-white transition-colors"
        title={t("a.toolbar.undo")}
      >
        ↶
      </button>
      <button
        onClick={() => void useStore.getState().redo()}
        className="w-7 h-7 rounded-md text-gray-400 hover:text-white transition-colors"
        title={t("a.toolbar.redo")}
      >
        ↷
      </button>

      <div className="w-px h-6 bg-white/10" />

      <button
        onClick={() => useStore.getState().fitView()}
        className="px-2 py-1 rounded-md text-xs text-gray-400 hover:text-white transition-colors"
        title={t("a.toolbar.fitTitle")}
      >
        {t("a.toolbar.fit")}
      </button>
      <button
        onClick={() => useStore.getState().setView(1, 0, 0)}
        className="px-2 py-1 rounded-md text-xs text-gray-400 hover:text-white transition-colors whitespace-nowrap"
        title={t("a.toolbar.resetTitle")}
      >
        {t("a.toolbar.reset")}
      </button>

      {/* Live-sync state */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${liveConnected ? "bg-emerald-400 bubble-pulse" : "bg-gray-600"}`}
        title={liveConnected ? t("a.toolbar.liveOn") : t("a.toolbar.liveOff")}
      />
      {connectionError && (
        <button
          onClick={() => setConnectionsOpen(true)}
          className="w-4 h-4 rounded-full bg-red-500/20 border border-red-500/60 text-red-400 text-[10px] leading-none shrink-0"
          title={t("a.toolbar.syncError", { msg: connectionError.statusMessage ?? t("a.toolbar.unknown") })}
        >
          !
        </button>
      )}

      <button
        onClick={() => setLocale(locale === "de" ? "en" : "de")}
        className="px-1.5 h-7 rounded-md text-[10px] text-gray-400 hover:text-white transition-colors"
        title={t("lang.toggle")}
      >
        {locale.toUpperCase()}
      </button>

      <AutopilotPopover canvasId={canvasId} />

      {/* Overflow menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`w-7 h-7 rounded-md text-sm transition-colors ${
            menuOpen ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
          }`}
          title={t("a.toolbar.more")}
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-9 z-50 w-60 rounded-xl bg-[#1a1d24]/98 border border-white/15 shadow-2xl py-1.5 max-h-[70vh] overflow-y-auto">
              <MenuLabel>{t("a.toolbar.export")}</MenuLabel>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  exportMarkdown(canvasName, useStore.getState().tasks, bubbles);
                }}
              >
                {t("a.toolbar.exportMd")}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  exportCsv(canvasName, useStore.getState().tasks);
                }}
              >
                {t("a.toolbar.exportCsv")}
              </MenuItem>
              <MenuItem
                onClick={async () => {
                  setMenuOpen(false);
                  try {
                    exportJson(canvasName, await api.exportCanvas(canvasId));
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                {t("a.toolbar.exportJson")}
              </MenuItem>
              <MenuItem onClick={importJson}>{t("a.toolbar.importJson")}</MenuItem>

              <MenuDivider />
              <MenuLabel>{t("a.toolbar.integrations")}</MenuLabel>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  setConnectionsOpen(true);
                }}
              >
                {t("a.toolbar.connections")} {connections.length > 0 && `(${connections.length})`}
              </MenuItem>
              {connections.length > 0 && (
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    for (const c of connections) {
                      void useStore.getState().syncConnection(c.id).catch(() => {});
                    }
                  }}
                >
                  {t("a.toolbar.syncAll")}
                </MenuItem>
              )}

              <MenuDivider />
              <MenuLabel>{t("a.toolbar.sharing")}</MenuLabel>
              <MenuItem onClick={() => void copyTokenUrl("share")}>
                {t("a.toolbar.copyShare")}
              </MenuItem>
              {canvas?.shareToken && (
                <MenuItem onClick={() => void revokeShare()}>{t("a.toolbar.revokeShare")}</MenuItem>
              )}
              <MenuItem onClick={() => void copyTokenUrl("ics")}>
                {t("a.toolbar.copyIcs")}
              </MenuItem>
              <MenuItem onClick={() => void copyTokenUrl("capture")}>
                {t("a.toolbar.copyCapture")}
              </MenuItem>

              <MenuDivider />
              <MenuLabel>{t("a.toolbar.portals")}</MenuLabel>
              {canvases.filter((c) => c.id !== canvasId).length === 0 && (
                <div className="px-3 py-1 text-[10px] text-gray-600">{t("a.toolbar.noOtherCanvases")}</div>
              )}
              {canvases
                .filter((c) => c.id !== canvasId)
                .map((c) => (
                  <MenuItem key={c.id} onClick={() => void addPortal(c.id)}>
                    {t("a.toolbar.portalTo", { name: c.name })}
                  </MenuItem>
                ))}

              <MenuDivider />
              <MenuLabel>{t("a.toolbar.constellations")}</MenuLabel>
              {templates.length === 0 && (
                <div className="px-3 py-1 text-[10px] text-gray-600">{t("a.toolbar.noneSaved")}</div>
              )}
              {templates.map((tpl) => (
                <div key={tpl.id} className="group flex items-center">
                  <MenuItem onClick={() => void stampTemplate(tpl)}>{t("a.toolbar.stamp", { name: tpl.name })}</MenuItem>
                  <button
                    onClick={() => {
                      api.deleteTemplate(tpl.id).then(() => setTemplates(templates.filter((x) => x.id !== tpl.id))).catch(console.error);
                    }}
                    className="opacity-0 group-hover:opacity-100 px-2 text-gray-600 hover:text-red-400 text-xs transition-all"
                  >
                    ×
                  </button>
                </div>
              ))}

              <MenuDivider />
              <MenuLabel>{t("a.toolbar.zones")}</MenuLabel>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  useStore.getState().setZoneDraw(true);
                }}
              >
                {t("a.toolbar.drawZone")}
              </MenuItem>
              <MenuItem
                onClick={async () => {
                  setMenuOpen(false);
                  const store = useStore.getState();
                  const c = viewportCenterWorld();
                  const W = 720, H = 520, GAP = 40;
                  const quads = [
                    { label: t("a.toolbar.quad.doFirst"), autoTag: "urgent", hue: 0, dx: -W - GAP / 2, dy: -H - GAP / 2 },
                    { label: t("a.toolbar.quad.schedule"), autoTag: "schedule", hue: 210, dx: GAP / 2, dy: -H - GAP / 2 },
                    { label: t("a.toolbar.quad.delegate"), autoTag: "delegate", hue: 45, dx: -W - GAP / 2, dy: GAP / 2 },
                    { label: t("a.toolbar.quad.drop"), autoTag: "drop", hue: 280, dx: GAP / 2, dy: GAP / 2 },
                  ];
                  try {
                    for (const q of quads) {
                      await store.addZone({
                        canvasId, x: c.x + q.dx, y: c.y + q.dy, w: W, h: H,
                        label: q.label, hue: q.hue, autoTag: q.autoTag,
                      });
                    }
                    store.showToast(t("a.toolbar.toast.eisenhower"));
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                {t("a.toolbar.eisenhower")}
              </MenuItem>

              <MenuDivider />
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  onOpenPulse();
                }}
              >
                {t("a.toolbar.pulse")}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  useStore.getState().setViewMode("table");
                }}
              >
                {t("a.toolbar.ledger")}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  useStore.getState().setDayDockOpen(true);
                }}
              >
                {t("a.toolbar.dayDock")}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  onOpenTimelapse();
                }}
              >
                {t("a.toolbar.timelapse")}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  startReview();
                }}
              >
                {t("a.toolbar.review")}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  useStore.getState().setHelpOpen(true);
                }}
              >
                {t("help.open")}
              </MenuItem>
            </div>
          </>
        )}
      </div>

      {connectionsOpen && (
        <ConnectionsModal canvasId={canvasId} onClose={() => setConnectionsOpen(false)} />
      )}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors truncate"
    >
      {children}
    </button>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-gray-600">{children}</div>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-white/10" />;
}
