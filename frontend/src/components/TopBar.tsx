import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../data/api";
import { useStore } from "../store";
import { exportCsv, exportJson, exportMarkdown, pickJsonFile } from "../utils/exporters";
import { ConnectionsModal } from "./ConnectionsModal";
import { CanvasSwitcher } from "./CanvasSwitcher";
import { useLocale, useT } from "../i18n";
import { history } from "../engine/history";
import { MenuDivider, MenuItem, MenuLabel, MenuPanel, useMenuSet } from "./toolbarMenu";
import { IconDots, IconEye, IconUndo } from "./ui/icons";

type TopBarMenu = "visibility" | "more";

/** The slim global command row: everything here is canvas-agnostic chrome
 * (search, visibility filters, undo, sync status, language, data actions).
 * Canvas-scoped tools live in the floating CanvasToolbar over the field. */
export function TopBar({ canvasId }: { canvasId: string | null }) {
  const tasks = useStore((s) => s.tasks);
  const showDone = useStore((s) => s.showDone);
  const toggleShowDone = useStore((s) => s.toggleShowDone);
  const showArchived = useStore((s) => s.showArchived);
  const toggleShowArchived = useStore((s) => s.toggleShowArchived);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const canvases = useStore((s) => s.canvases);
  const bubbles = useStore((s) => s.bubbles);
  const liveConnected = useStore((s) => s.liveConnected);
  const connections = useStore((s) => s.connections);
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const navigate = useNavigate();
  const menus = useMenuSet<TopBarMenu>();
  const connectionError = connections.find((c) => c.status === "error");
  const canvas = canvases.find((c) => c.id === canvasId);
  const canvasName = canvas?.name ?? "canvas";
  const activeCount = tasks.filter((task) => !task.archivedAt && !task.done && !task.inbox).length;

  const copyTokenUrl = async (kind: "share" | "ics" | "capture") => {
    menus.closeAll();
    if (!canvasId) return;
    try {
      let token = kind === "share" ? canvas?.shareToken : kind === "ics" ? canvas?.icsToken : canvas?.captureToken;
      if (!token) {
        const saved = await api.mintToken(canvasId, kind);
        useStore.setState({ canvases: useStore.getState().canvases.map((c) => (c.id === canvasId ? saved : c)) });
        token = kind === "share" ? saved.shareToken : kind === "ics" ? saved.icsToken : saved.captureToken;
      }
      const url = kind === "share" ? `${location.origin}/share/${token}`
        : kind === "ics" ? `${location.origin}/api/feeds/${token}.ics`
          : `${location.origin}/api/capture/${token}`;
      await navigator.clipboard.writeText(url);
      useStore.getState().showToast(
        kind === "share" ? t("a.toolbar.toast.shareCopied") : kind === "ics" ? t("a.toolbar.toast.icsCopied") : t("a.toolbar.toast.captureCopied"),
      );
    } catch (e) {
      console.error(e);
      useStore.getState().showToast(t("a.toolbar.toast.mintFailed"));
    }
  };

  const revokeShare = async () => {
    menus.closeAll();
    if (!canvasId) return;
    try {
      const saved = await api.revokeToken(canvasId, "share");
      useStore.setState({ canvases: useStore.getState().canvases.map((c) => (c.id === canvasId ? saved : c)) });
      useStore.getState().showToast(t("a.toolbar.toast.shareRevoked"));
    } catch (e) {
      console.error(e);
    }
  };

  const importJson = async () => {
    menus.closeAll();
    const payload = await pickJsonFile();
    if (!payload) return;
    try {
      const imported = await api.importCanvas(payload);
      await useStore.getState().loadCanvases();
      navigate(`/canvas/${imported.id}`);
      useStore.getState().showToast(t("a.toolbar.toast.imported", { name: imported.name }));
    } catch (e) {
      console.error(e);
      useStore.getState().showToast(t("a.toolbar.toast.importFailed"));
    }
  };

  return (
    <div role="toolbar" aria-label={t("d.shell.globalCommands")} className="top-bar">
      {/* Nimbus wordmark — a glowing halo dot, matching the bubble motif */}
      <span className="flex shrink-0 items-center gap-2 pl-1 pr-2">
        <span
          aria-hidden="true"
          className="w-3 h-3 rounded-full bubble-pulse shrink-0"
          style={{
            background: "radial-gradient(circle, var(--nc-accent), var(--nc-select-surface))",
            boxShadow: "0 0 12px 2px color-mix(in srgb, var(--nc-accent) 60%, transparent)",
          }}
        />
        <span className="font-nc-display text-sm font-semibold text-nc-text">{t("app.name")}</span>
      </span>
      <CanvasSwitcher canvases={canvases} canvasId={canvasId} />
      <label data-topbar="search" className="canvas-toolbar__search">
        <span className="sr-only">{t("a.toolbar.search")}</span>
        <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); setSearchQuery(""); (e.target as HTMLInputElement).blur(); }
        }} placeholder={t("a.toolbar.searchPlaceholder")} />
      </label>
      <div className="relative">
        <button ref={menus.setTriggerRef("visibility")} data-topbar="visibility" aria-label={`${t("a.toolbar.visibility")}: ${t("a.toolbar.showDone")}, ${t("a.toolbar.showArchived")}`} aria-haspopup="menu" aria-expanded={menus.isOpen("visibility")} onClick={() => menus.open("visibility")} onKeyDown={menus.onTriggerKeyDown("visibility")} title={t("a.toolbar.visibility")} className="canvas-toolbar__primary-action">
          <IconEye />
        </button>
        {menus.isOpen("visibility") && <MenuPanel ref={menus.setMenuRef("visibility")} role="menu" aria-label={t("a.toolbar.visibility")} onKeyDown={menus.onMenuKeyDown("visibility")} className="canvas-toolbar__menu">
          <MenuLabel>{t("a.toolbar.visibility")}</MenuLabel>
          <MenuItem checked={showDone} onClick={() => { toggleShowDone(); menus.close("visibility"); }}>{t("a.toolbar.showDone")}</MenuItem>
          <MenuItem checked={showArchived} onClick={() => { toggleShowArchived(); menus.close("visibility"); }}>{t("a.toolbar.showArchived")}</MenuItem>
        </MenuPanel>}
      </div>
      <button data-topbar="undo" onClick={() => void useStore.getState().undo()} className="canvas-toolbar__primary-action" aria-label={t("a.toolbar.undo")} title={t("a.toolbar.undo")}><IconUndo /></button>
      <div className="top-bar__utilities">
        <span className="text-xs text-nc-muted whitespace-nowrap">{t("a.toolbar.active")} <span className="text-nc-text">{activeCount}</span></span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${liveConnected ? "bg-nc-success bubble-pulse" : "bg-nc-faint"}`} role="status" aria-live="polite" aria-label={liveConnected ? t("a.toolbar.liveOn") : t("a.toolbar.liveOff")} />
        {connectionError && <button onClick={() => setConnectionsOpen(true)} className="w-7 h-7 rounded-full bg-nc-danger-muted border border-nc-danger text-nc-danger" aria-label={t("a.toolbar.syncError", { msg: connectionError.statusMessage ?? t("a.toolbar.unknown") })}>!</button>}
        <button data-topbar="language" onClick={() => setLocale(locale === "de" ? "en" : "de")} className="canvas-toolbar__utility-button" title={t("lang.toggle")}>{locale.toUpperCase()}</button>
        <div className="relative">
          <button
            ref={menus.setTriggerRef("more")}
            data-topbar="more"
            data-redo-available={history.canRedo}
            aria-label={t("a.toolbar.more")}
            aria-haspopup="menu"
            aria-expanded={menus.isOpen("more")}
            onClick={() => menus.open("more")}
            onKeyDown={menus.onTriggerKeyDown("more")}
            className={`canvas-toolbar__utility-button ${menus.isOpen("more") ? "bg-nc-fill text-nc-text" : "text-nc-muted hover:text-nc-text"}`}
            title={t("a.toolbar.more")}
          >
            <IconDots />
          </button>
          {menus.isOpen("more") && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => menus.closeAll()} />
              <MenuPanel ref={menus.setMenuRef("more")} role="menu" aria-label={t("a.toolbar.more")} onKeyDown={menus.onMenuKeyDown("more")} className="canvas-toolbar__menu canvas-toolbar__menu--right canvas-toolbar__menu--more">
                {history.canRedo && <>
                  <MenuLabel>{t("a.toolbar.history")}</MenuLabel>
                  <MenuItem onClick={() => { void useStore.getState().redo(); menus.close("more"); }}>{t("a.toolbar.redo")}</MenuItem>
                  <MenuDivider />
                </>}
                {canvasId && <>
                  <MenuLabel>{t("a.toolbar.export")}</MenuLabel>
                  <MenuItem onClick={() => { menus.closeAll(); exportMarkdown(canvasName, useStore.getState().tasks, bubbles); }}>{t("a.toolbar.exportMd")}</MenuItem>
                  <MenuItem onClick={() => { menus.closeAll(); exportCsv(canvasName, useStore.getState().tasks); }}>{t("a.toolbar.exportCsv")}</MenuItem>
                  <MenuItem onClick={async () => {
                    menus.closeAll();
                    try { exportJson(canvasName, await api.exportCanvas(canvasId)); } catch (e) { console.error(e); }
                  }}>{t("a.toolbar.exportJson")}</MenuItem>
                  <MenuItem onClick={importJson}>{t("a.toolbar.importJson")}</MenuItem>
                  <MenuDivider />
                  <MenuLabel>{t("a.toolbar.integrations")}</MenuLabel>
                  <MenuItem onClick={() => { menus.closeAll(); setConnectionsOpen(true); }}>
                    {t("a.toolbar.connections")} {connections.length > 0 && `(${connections.length})`}
                  </MenuItem>
                  {connections.length > 0 && (
                    <MenuItem onClick={() => {
                      menus.closeAll();
                      for (const c of connections) void useStore.getState().syncConnection(c.id).catch(() => {});
                    }}>{t("a.toolbar.syncAll")}</MenuItem>
                  )}
                  <MenuDivider />
                  <MenuLabel>{t("a.toolbar.sharing")}</MenuLabel>
                  <MenuItem onClick={() => void copyTokenUrl("share")}>{t("a.toolbar.copyShare")}</MenuItem>
                  {canvas?.shareToken && <MenuItem onClick={() => void revokeShare()}>{t("a.toolbar.revokeShare")}</MenuItem>}
                  <MenuItem onClick={() => void copyTokenUrl("ics")}>{t("a.toolbar.copyIcs")}</MenuItem>
                  <MenuItem onClick={() => void copyTokenUrl("capture")}>{t("a.toolbar.copyCapture")}</MenuItem>
                  <MenuDivider />
                </>}
                <MenuItem onClick={() => { menus.closeAll(); useStore.getState().setHelpOpen(true); }}>{t("help.open")}</MenuItem>
              </MenuPanel>
            </>
          )}
        </div>
      </div>
      {connectionsOpen && canvasId && <ConnectionsModal canvasId={canvasId} onClose={() => setConnectionsOpen(false)} />}
    </div>
  );
}
