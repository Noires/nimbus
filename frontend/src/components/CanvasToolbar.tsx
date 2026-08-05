import { useEffect, useState } from "react";
import { api, type Template } from "../data/api";
import { useStore, CARD_W, CARD_H, type LensMode } from "../store";
import { startReview } from "./ReviewMode";
import { AutopilotPopover } from "./AutopilotPopover";
import { OrbitPopover } from "./OrbitPopover";
import { useT } from "../i18n";
import { MenuDivider, MenuItem, MenuLabel, MenuPanel, useMenuSet } from "./toolbarMenu";
import { IconFrame, IconGrid, IconLens, IconWrench } from "./ui/icons";

interface CanvasToolbarProps {
  canvasId: string;
  onAddTask: () => void;
  onOpenTimelapse: () => void;
  onOpenPulse: () => void;
}

type CanvasToolbarMenu = "lens" | "view" | "arrange" | "tools";

const LENSES: Array<{ mode: LensMode; labelKey: string; titleKey: string }> = [
  { mode: "time", labelKey: "a.toolbar.lens.time", titleKey: "a.toolbar.lens.timeTitle" },
  { mode: "gravity", labelKey: "a.toolbar.lens.gravity", titleKey: "a.toolbar.lens.gravityTitle" },
  { mode: "heat", labelKey: "a.toolbar.lens.heat", titleKey: "a.toolbar.lens.heatTitle" },
];

/** Canvas-scoped tools floating over the spatial field. Renders only on the
 * canvas route — global chrome (search, undo, visibility, data actions) lives
 * in the TopBar. */
export function CanvasToolbar({ canvasId, onAddTask, onOpenTimelapse, onOpenPulse }: CanvasToolbarProps) {
  const lens = useStore((s) => s.lens);
  const setLens = useStore((s) => s.setLens);
  const cardDensity = useStore((s) => s.cardDensity);
  const canvases = useStore((s) => s.canvases);
  const t = useT();
  const menus = useMenuSet<CanvasToolbarMenu>();
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (menus.isOpen("tools")) {
      api.listTemplates().then(setTemplates).catch(() => setTemplates([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menus.openName]);

  const viewportCenterWorld = () => {
    const { zoom, panX, panY, viewportW, viewportH } = useStore.getState();
    return { x: (viewportW / 2 - panX) / zoom, y: (viewportH / 2 - panY) / zoom };
  };

  const stampTemplate = async (template: Template) => {
    menus.closeAll();
    const store = useStore.getState();
    try {
      const center = viewportCenterWorld();
      const { tasks: created, title } = await api.instantiateTemplate(template.id, canvasId, center.x, center.y);
      await store.refreshTasks(canvasId);
      if (created.length >= 2) {
        await api.createBubble({ canvasId, title, memberIds: created.map((task) => task.id) });
        await store.loadBubbles(canvasId);
      }
      const cx = created.reduce((sum, task) => sum + task.x + CARD_W / 2, 0) / created.length;
      const cy = created.reduce((sum, task) => sum + task.y + CARD_H / 2, 0) / created.length;
      store.flyTo(cx, cy, 0.85);
      store.showToast(t("a.toolbar.toast.stamped", { name: template.name, count: created.length }));
    } catch (e) {
      console.error(e);
      store.showToast(t("a.toolbar.toast.stampFailed"));
    }
  };

  const addPortal = async (targetCanvasId: string) => {
    menus.closeAll();
    const center = viewportCenterWorld();
    try {
      await useStore.getState().addPortal(canvasId, targetCanvasId, center.x, center.y);
    } catch (e) {
      console.error(e);
    }
  };

  const addEisenhower = async () => {
    menus.closeAll();
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
        await store.addZone({ canvasId, x: c.x + q.dx, y: c.y + q.dy, w: W, h: H, label: q.label, hue: q.hue, autoTag: q.autoTag });
      }
      store.showToast(t("a.toolbar.toast.eisenhower"));
    } catch (e) {
      console.error(e);
    }
  };

  const currentLens = lens === "off" ? t("a.toolbar.lens.off") : t(LENSES.find((item) => item.mode === lens)!.labelKey);
  const otherCanvases = canvases.filter((c) => c.id !== canvasId);

  return (
    <div role="toolbar" aria-label={t("a.toolbar.label")} className="canvas-toolbar absolute top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="canvas-toolbar__primary">
        <button data-toolbar-primary="new-task" onClick={onAddTask} className="canvas-toolbar__primary-action canvas-toolbar__new-task" title={t("a.toolbar.addTitle")}>
          <span aria-hidden="true">+</span> {t("a.toolbar.add")}
        </button>
        <div className="relative">
          <button ref={menus.setTriggerRef("lens")} data-toolbar-primary="lens" aria-haspopup="menu" aria-expanded={menus.isOpen("lens")} onClick={() => menus.open("lens")} onKeyDown={menus.onTriggerKeyDown("lens")} className="canvas-toolbar__primary-action canvas-toolbar__labelled"><IconLens size={16} />
            {t("a.toolbar.lens")}: {currentLens}
          </button>
          {menus.isOpen("lens") && <MenuPanel ref={menus.setMenuRef("lens")} role="menu" aria-label={t("a.toolbar.lens")} onKeyDown={menus.onMenuKeyDown("lens")} className="canvas-toolbar__menu">
            <MenuLabel>{t("a.toolbar.lens")}</MenuLabel>
            {LENSES.map(({ mode, labelKey, titleKey }) => <MenuItem key={mode} kind="radio" checked={lens === mode} onClick={() => { setLens(lens === mode ? "off" : mode); menus.close("lens"); }} title={t(titleKey)}>{t(labelKey)}</MenuItem>)}
          </MenuPanel>}
        </div>
        <div className="relative">
          <button ref={menus.setTriggerRef("view")} data-toolbar-primary="view" aria-haspopup="menu" aria-expanded={menus.isOpen("view")} onClick={() => menus.open("view")} onKeyDown={menus.onTriggerKeyDown("view")} className="canvas-toolbar__primary-action canvas-toolbar__labelled"><IconFrame size={16} />{t("a.toolbar.view")}</button>
          {menus.isOpen("view") && <MenuPanel ref={menus.setMenuRef("view")} role="menu" aria-label={t("a.toolbar.view")} onKeyDown={menus.onMenuKeyDown("view")} className="canvas-toolbar__menu">
            <MenuLabel>{t("a.toolbar.view")}</MenuLabel>
            <OrbitPopover />
            <MenuItem onClick={() => { useStore.getState().fitView(); menus.close("view"); }}>{t("a.toolbar.fit")}</MenuItem>
            <MenuItem onClick={() => { useStore.getState().setView(1, 0, 0); menus.close("view"); }}>{t("a.toolbar.reset")}</MenuItem>
            <MenuItem checked={cardDensity === "mini"} onClick={() => { menus.close("view"); useStore.getState().setCardDensity(cardDensity === "mini" ? "full" : "mini", canvasId); }}>{t("a.toolbar.miniCards")}</MenuItem>
            <MenuItem onClick={() => { menus.close("view", false); useStore.getState().setViewMode("table"); }}>{t("a.toolbar.tableView")}</MenuItem>
            <AutopilotPopover canvasId={canvasId} />
          </MenuPanel>}
        </div>
        <div className="relative">
          <button ref={menus.setTriggerRef("arrange")} data-toolbar-primary="arrange" aria-haspopup="menu" aria-expanded={menus.isOpen("arrange")} onClick={() => menus.open("arrange")} onKeyDown={menus.onTriggerKeyDown("arrange")} className="canvas-toolbar__primary-action canvas-toolbar__labelled"><IconGrid size={16} />{t("a.toolbar.arrange")}</button>
          {menus.isOpen("arrange") && <MenuPanel ref={menus.setMenuRef("arrange")} role="menu" aria-label={t("a.toolbar.arrange")} onKeyDown={menus.onMenuKeyDown("arrange")} className="canvas-toolbar__menu">
            <MenuLabel>{t("a.toolbar.zones")}</MenuLabel>
            <MenuItem onClick={() => { menus.close("arrange", false); useStore.getState().setZoneDraw(true); }}>{t("a.toolbar.drawZone")}</MenuItem>
            <MenuItem onClick={() => void addEisenhower()}>{t("a.toolbar.eisenhower")}</MenuItem>
            <MenuDivider />
            <MenuItem onClick={() => { menus.close("arrange"); void useStore.getState().tidyCanvas().catch((e) => console.error(e)); }}>{t("a.toolbar.tidy")}</MenuItem>
            <MenuLabel>{t("a.toolbar.autoArrange")}</MenuLabel>
            {(["tag", "status", "priority", "due"] as const).map((mode) => (
              <MenuItem key={mode} onClick={() => { menus.close("arrange"); void useStore.getState().autoArrangeCanvas(mode).catch((e) => console.error(e)); }}>
                {t(`a.toolbar.autoArrange.${mode}`)}
              </MenuItem>
            ))}
          </MenuPanel>}
        </div>
        <div className="relative">
          <button ref={menus.setTriggerRef("tools")} data-toolbar-primary="tools" aria-haspopup="menu" aria-expanded={menus.isOpen("tools")} onClick={() => menus.open("tools")} onKeyDown={menus.onTriggerKeyDown("tools")} className="canvas-toolbar__primary-action canvas-toolbar__labelled"><IconWrench size={16} />{t("a.toolbar.tools")}</button>
          {menus.isOpen("tools") && <MenuPanel ref={menus.setMenuRef("tools")} role="menu" aria-label={t("a.toolbar.tools")} onKeyDown={menus.onMenuKeyDown("tools")} className="canvas-toolbar__menu canvas-toolbar__menu--right canvas-toolbar__menu--more">
            <MenuLabel>{t("a.toolbar.portals")}</MenuLabel>
            {otherCanvases.length === 0 && <div className="px-3 py-1 text-2xs text-nc-faint">{t("a.toolbar.noOtherCanvases")}</div>}
            {otherCanvases.map((c) => (
              <MenuItem key={c.id} onClick={() => void addPortal(c.id)}>{t("a.toolbar.portalTo", { name: c.name })}</MenuItem>
            ))}
            <MenuDivider />
            <MenuLabel>{t("a.toolbar.constellations")}</MenuLabel>
            {templates.length === 0 && <div className="px-3 py-1 text-2xs text-nc-soft">{t("a.toolbar.noneSaved")}</div>}
            {templates.map((tpl) => (
              <div key={tpl.id} className="group flex items-center">
                <MenuItem onClick={() => void stampTemplate(tpl)}>{t("a.toolbar.stamp", { name: tpl.name })}</MenuItem>
                <button
                  onClick={() => {
                    api.deleteTemplate(tpl.id).then(() => setTemplates(templates.filter((x) => x.id !== tpl.id))).catch(console.error);
                  }}
                  className="opacity-0 group-hover:opacity-100 px-2 text-nc-faint hover:text-nc-danger text-xs transition-all"
                >
                  ×
                </button>
              </div>
            ))}
            <MenuDivider />
            <MenuItem onClick={() => { menus.close("tools", false); useStore.getState().setDayDockOpen(true); }}>{t("a.toolbar.dayDock")}</MenuItem>
            <MenuItem onClick={() => { menus.close("tools", false); onOpenTimelapse(); }}>{t("a.toolbar.timelapse")}</MenuItem>
            <MenuItem onClick={() => { menus.close("tools", false); startReview(); }}>{t("a.toolbar.review")}</MenuItem>
            <MenuItem onClick={() => { menus.close("tools", false); onOpenPulse(); }}>{t("a.toolbar.pulse")}</MenuItem>
          </MenuPanel>}
        </div>
      </div>
    </div>
  );
}
