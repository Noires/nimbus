import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Template } from "../data/api";
import { useStore, CARD_W, CARD_H, type LensMode } from "../store";
import { exportCsv, exportJson, exportMarkdown, pickJsonFile } from "../utils/exporters";
import { startReview } from "./ReviewMode";
import { AutopilotPopover } from "./AutopilotPopover";
import { OrbitPopover } from "./OrbitPopover";
import { ConnectionsModal } from "./ConnectionsModal";
import { useLocale, useT } from "../i18n";
import { history } from "../engine/history";

interface ToolbarProps {
  canvasId: string;
  onAddTask: () => void;
  onOpenTimelapse: () => void;
  onOpenPulse: () => void;
}

type ToolbarMenu = "lens" | "visibility" | "view" | "more";

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
  const cardDensity = useStore((s) => s.cardDensity);
  const setLens = useStore((s) => s.setLens);
  const canvases = useStore((s) => s.canvases);
  const bubbles = useStore((s) => s.bubbles);
  const liveConnected = useStore((s) => s.liveConnected);
  const connections = useStore((s) => s.connections);
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lensOpen, setLensOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const lensButtonRef = useRef<HTMLButtonElement>(null);
  const visibilityButtonRef = useRef<HTMLButtonElement>(null);
  const viewButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const lensMenuRef = useRef<HTMLDivElement>(null);
  const visibilityMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const connectionError = connections.find((c) => c.status === "error");
  const [templates, setTemplates] = useState<Template[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (menuOpen) {
      api.listTemplates().then(setTemplates).catch(() => setTemplates([]));
    }
  }, [menuOpen]);

  const menuRef = (name: ToolbarMenu) => ({ lens: lensMenuRef, visibility: visibilityMenuRef, view: viewMenuRef, more: moreMenuRef })[name];
  const triggerRef = (name: ToolbarMenu) => ({ lens: lensButtonRef, visibility: visibilityButtonRef, view: viewButtonRef, more: moreButtonRef })[name];

  const enabledMenuItems = (name: ToolbarMenu) => Array.from(menuRef(name).current?.querySelectorAll<HTMLElement>("[role^='menuitem']") ?? [])
    .filter((item) => !item.hasAttribute("disabled") && item.getAttribute("aria-disabled") !== "true");

  const focusMenuItem = (name: ToolbarMenu, target: "first" | "last" = "first") => {
    const items = enabledMenuItems(name);
    items[target === "first" ? 0 : items.length - 1]?.focus();
  };

  const closeMenu = (name: ToolbarMenu, restoreFocus = true) => {
    ({ lens: setLensOpen, visibility: setVisibilityOpen, view: setViewOpen, more: setMenuOpen })[name](false);
    if (restoreFocus) triggerRef(name).current?.focus();
  };

  const openMenu = (name: ToolbarMenu) => {
    setLensOpen(name === "lens");
    setVisibilityOpen(name === "visibility");
    setViewOpen(name === "view");
    setMenuOpen(name === "more");
  };

  const onMenuTriggerKeyDown = (name: ToolbarMenu) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["Enter", " ", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    openMenu(name);
  };

  const onMenuKeyDown = (name: ToolbarMenu) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = enabledMenuItems(name);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(name);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next]?.focus();
    }
  };

  useEffect(() => {
    const openMenuName: ToolbarMenu | undefined = lensOpen ? "lens" : visibilityOpen ? "visibility" : viewOpen ? "view" : menuOpen ? "more" : undefined;
    if (openMenuName) requestAnimationFrame(() => focusMenuItem(openMenuName));
  }, [lensOpen, visibilityOpen, viewOpen, menuOpen]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (lensOpen) closeMenu("lens");
      else if (visibilityOpen) closeMenu("visibility");
      else if (viewOpen) closeMenu("view");
      else if (menuOpen) closeMenu("more");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [lensOpen, visibilityOpen, viewOpen, menuOpen]);

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

  const currentLens = lens === "off" ? t("a.toolbar.lens.off") : t(LENSES.find((item) => item.mode === lens)!.labelKey);

  return (
    <div role="toolbar" aria-label={t("a.toolbar.label")} className="canvas-toolbar absolute top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="canvas-toolbar__primary">
        <button data-toolbar-primary="new-task" onClick={onAddTask} className="canvas-toolbar__primary-action canvas-toolbar__new-task" title={t("a.toolbar.addTitle")}>
          <span aria-hidden="true">+</span> {t("a.toolbar.add")}
        </button>
        <label data-toolbar-primary="search" className="canvas-toolbar__search">
          <span className="sr-only">{t("a.toolbar.search")}</span>
          <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Escape") { e.stopPropagation(); setSearchQuery(""); (e.target as HTMLInputElement).blur(); }
          }} placeholder={t("a.toolbar.searchPlaceholder")} />
        </label>
        <div className="relative">
          <button ref={lensButtonRef} data-toolbar-primary="lens" aria-haspopup="menu" aria-expanded={lensOpen} onClick={() => openMenu("lens")} onKeyDown={onMenuTriggerKeyDown("lens")} className="canvas-toolbar__primary-action">
            {t("a.toolbar.lens")}: {currentLens}
          </button>
          {lensOpen && <div ref={lensMenuRef} role="menu" aria-label={t("a.toolbar.lens")} onKeyDown={onMenuKeyDown("lens")} className="canvas-toolbar__menu">
            <MenuLabel>{t("a.toolbar.lens")}</MenuLabel>
            {LENSES.map(({ mode, labelKey, titleKey }) => <MenuItem key={mode} kind="radio" checked={lens === mode} onClick={() => { setLens(lens === mode ? "off" : mode); closeMenu("lens"); }} title={t(titleKey)}>{t(labelKey)}</MenuItem>)}
          </div>}
        </div>
        <div className="relative">
          <button ref={visibilityButtonRef} data-toolbar-primary="visibility" aria-label={`${t("a.toolbar.visibility")}: ${t("a.toolbar.showDone")}, ${t("a.toolbar.showArchived")}`} aria-haspopup="menu" aria-expanded={visibilityOpen} onClick={() => openMenu("visibility")} onKeyDown={onMenuTriggerKeyDown("visibility")} className="canvas-toolbar__primary-action">
            {t("a.toolbar.visibility")}
          </button>
          {visibilityOpen && <div ref={visibilityMenuRef} role="menu" aria-label={t("a.toolbar.visibility")} onKeyDown={onMenuKeyDown("visibility")} className="canvas-toolbar__menu">
            <MenuLabel>{t("a.toolbar.visibility")}</MenuLabel>
            <MenuItem checked={showDone} onClick={() => { toggleShowDone(); closeMenu("visibility"); }}>{t("a.toolbar.showDone")}</MenuItem>
            <MenuItem checked={showArchived} onClick={() => { toggleShowArchived(); closeMenu("visibility"); }}>{t("a.toolbar.showArchived")}</MenuItem>
          </div>}
        </div>
        <button data-toolbar-primary="undo" onClick={() => void useStore.getState().undo()} className="canvas-toolbar__primary-action" title={t("a.toolbar.undo")}>↶ {t("a.toolbar.undoShort")}</button>
        <div className="relative">
          <button ref={viewButtonRef} data-toolbar-primary="view" aria-haspopup="menu" aria-expanded={viewOpen} onClick={() => openMenu("view")} onKeyDown={onMenuTriggerKeyDown("view")} className="canvas-toolbar__primary-action">{t("a.toolbar.view")}</button>
          {viewOpen && <div ref={viewMenuRef} role="menu" aria-label={t("a.toolbar.view")} onKeyDown={onMenuKeyDown("view")} className="canvas-toolbar__menu canvas-toolbar__menu--right">
            <MenuLabel>{t("a.toolbar.view")}</MenuLabel>
            <OrbitPopover />
            <MenuItem onClick={() => { useStore.getState().fitView(); closeMenu("view"); }}>{t("a.toolbar.fit")}</MenuItem>
            <MenuItem onClick={() => { useStore.getState().setView(1, 0, 0); closeMenu("view"); }}>{t("a.toolbar.reset")}</MenuItem>
            <AutopilotPopover canvasId={canvasId} />
          </div>}
        </div>
      </div>
      <div className="canvas-toolbar__utilities">
        <span className="text-xs text-gray-400 whitespace-nowrap">{t("a.toolbar.active")} <span className="text-gray-200">{activeCount}</span></span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${liveConnected ? "bg-emerald-400 bubble-pulse" : "bg-gray-600"}`} role="status" aria-live="polite" aria-label={liveConnected ? t("a.toolbar.liveOn") : t("a.toolbar.liveOff")} />
        {connectionError && <button onClick={() => setConnectionsOpen(true)} className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/60 text-red-400" aria-label={t("a.toolbar.syncError", { msg: connectionError.statusMessage ?? t("a.toolbar.unknown") })}>!</button>}
        <button data-toolbar-secondary="language" onClick={() => setLocale(locale === "de" ? "en" : "de")} className="canvas-toolbar__utility-button" title={t("lang.toggle")}>{locale.toUpperCase()}</button>

      {/* Overflow menu */}
      <div className="relative">
        <button
          ref={moreButtonRef}
          data-toolbar-secondary="more"
          data-redo-available={history.canRedo}
          aria-label={t("a.toolbar.more")}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => openMenu("more")}
          onKeyDown={onMenuTriggerKeyDown("more")}
          className={`canvas-toolbar__utility-button ${
            menuOpen ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
          }`}
          title={t("a.toolbar.more")}
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div ref={moreMenuRef} role="menu" aria-label={t("a.toolbar.more")} onKeyDown={onMenuKeyDown("more")} className="canvas-toolbar__menu canvas-toolbar__menu--right canvas-toolbar__menu--more">
              {history.canRedo && <>
                <MenuLabel>{t("a.toolbar.history")}</MenuLabel>
                <MenuItem onClick={() => { void useStore.getState().redo(); setMenuOpen(false); moreButtonRef.current?.focus(); }}>{t("a.toolbar.redo")}</MenuItem>
                <MenuDivider />
              </>}
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
                checked={cardDensity === "mini"}
                onClick={() => {
                  setMenuOpen(false);
                  useStore.getState().setCardDensity(cardDensity === "mini" ? "full" : "mini", canvasId);
                }}
              >
                {t("a.toolbar.miniCards")}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  void useStore.getState().tidyCanvas().catch((e) => console.error(e));
                }}
              >
                {t("a.toolbar.tidy")}
              </MenuItem>
              <MenuLabel>{t("a.toolbar.autoArrange")}</MenuLabel>
              {(["tag", "status", "priority", "due"] as const).map((mode) => (
                <MenuItem
                  key={mode}
                  onClick={() => {
                    setMenuOpen(false);
                    void useStore.getState().autoArrangeCanvas(mode).catch((e) => console.error(e));
                  }}
                >
                  {t(`a.toolbar.autoArrange.${mode}`)}
                </MenuItem>
              ))}
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
      </div>

      {connectionsOpen && (
        <ConnectionsModal canvasId={canvasId} onClose={() => setConnectionsOpen(false)} />
      )}
    </div>
  );
}

function MenuItem({ onClick, children, checked, title, kind = checked === undefined ? "item" : "checkbox" }: { onClick: () => void; children: React.ReactNode; checked?: boolean; title?: string; kind?: "item" | "checkbox" | "radio" }) {
  const role = kind === "radio" ? "menuitemradio" : kind === "checkbox" ? "menuitemcheckbox" : "menuitem";
  return (
    <button
      role={role}
      aria-checked={kind === "item" ? undefined : checked}
      title={title}
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors whitespace-normal"
    >
      {checked ? "✓ " : ""}{children}
    </button>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-gray-300">{children}</div>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-white/10" />;
}
