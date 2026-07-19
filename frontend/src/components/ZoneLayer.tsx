import { useRef, useState } from "react";
import { useStore, CARD_W, CARD_H, type Zone } from "../store";
import { useT } from "../i18n";

// User-drawn labeled regions under the cards: quadrants, swimlanes,
// territories. Dragging the header moves the zone AND the cards inside it.
export function ZoneLayer() {
  const t = useT();
  const zones = useStore((s) => s.zones);
  const readOnly = useStore((s) => s.readOnly);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const drag = useRef<{
    pointerId: number;
    zoneId: string;
    mode: "move" | "resize";
    lastX: number;
    lastY: number;
    memberIds: string[];
  } | null>(null);

  if (zones.length === 0) return null;

  const startDrag = (e: React.PointerEvent, zone: Zone, mode: "move" | "resize") => {
    if (readOnly) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const tasks = useStore.getState().tasks;
    drag.current = {
      pointerId: e.pointerId,
      zoneId: zone.id,
      mode,
      lastX: e.clientX,
      lastY: e.clientY,
      // Cards ride along only on move, captured at drag start.
      memberIds:
        mode === "move"
          ? tasks
              .filter(
                (t) =>
                  t.x + CARD_W / 2 >= zone.x &&
                  t.x + CARD_W / 2 <= zone.x + zone.w &&
                  t.y + CARD_H / 2 >= zone.y &&
                  t.y + CARD_H / 2 <= zone.y + zone.h,
              )
              .map((t) => t.id)
          : [],
    };
  };

  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const store = useStore.getState();
    const dx = (e.clientX - d.lastX) / store.zoom;
    const dy = (e.clientY - d.lastY) / store.zoom;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    const zone = store.zones.find((z) => z.id === d.zoneId);
    if (!zone) return;
    if (d.mode === "move") {
      useStore.setState({
        zones: store.zones.map((z) => (z.id === d.zoneId ? { ...z, x: z.x + dx, y: z.y + dy } : z)),
      });
      if (d.memberIds.length) store.moveTasksLocal(d.memberIds, dx, dy);
    } else {
      useStore.setState({
        zones: store.zones.map((z) =>
          z.id === d.zoneId ? { ...z, w: Math.max(z.w + dx, 160), h: Math.max(z.h + dy, 120) } : z,
        ),
      });
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    const store = useStore.getState();
    const zone = store.zones.find((z) => z.id === d.zoneId);
    if (!zone) return;
    store.patchZone(zone.id, { x: zone.x, y: zone.y, w: zone.w, h: zone.h }).catch((err) => console.error(err));
    if (d.mode === "move" && d.memberIds.length) {
      const positions = new Map(
        store.tasks.filter((t) => d.memberIds.includes(t.id)).map((t) => [t.id, { x: t.x, y: t.y }]),
      );
      // Persist member positions (history-free: the zone move is the gesture).
      for (const [id, pos] of positions) {
        store.patchTask(id, { x: pos.x, y: pos.y }, { record: false }).catch((err) => console.error(err));
      }
    }
  };

  const saveLabel = (zone: Zone) => {
    setEditing(null);
    useStore.getState().patchZone(zone.id, { label: draft.trim() }).catch((e) => console.error(e));
  };

  return (
    <>
      {zones.map((zone) => (
        <div
          key={zone.id}
          className="absolute rounded-2xl"
          style={{
            left: zone.x,
            top: zone.y,
            width: zone.w,
            height: zone.h,
            background: `hsla(${zone.hue}, 70%, 50%, 0.05)`,
            border: `1.5px dashed hsla(${zone.hue}, 70%, 60%, 0.35)`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {/* Header: drag to move zone + contents */}
          <div
            className="absolute -top-3 left-4 flex items-center gap-1 group"
            onPointerDown={(e) => startDrag(e, zone, "move")}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {editing === zone.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => saveLabel(zone)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") saveLabel(zone);
                  if (e.key === "Escape") setEditing(null);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-6 w-40 px-2 rounded-full bg-[#0f0f13] text-[11px] text-gray-100 outline-none"
                style={{ border: `1.5px solid hsla(${zone.hue}, 70%, 60%, 0.6)` }}
              />
            ) : (
              <span
                className="h-6 px-2.5 rounded-full bg-[#1a1d24] text-[11px] flex items-center cursor-grab active:cursor-grabbing whitespace-nowrap"
                style={{
                  border: `1.5px solid hsla(${zone.hue}, 70%, 60%, 0.6)`,
                  color: `hsl(${zone.hue}, 70%, 75%)`,
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setDraft(zone.label);
                  setEditing(zone.id);
                }}
                title={t("b.zone.headerTitle")}
              >
                ▣ {zone.label || t("b.zone.default")}
                {zone.autoTag && <span className="ml-1.5 text-gray-500">#{zone.autoTag}</span>}
              </span>
            )}

            {!readOnly && (
              <span className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoneChipButton
                  hue={zone.hue}
                  title={t("b.zone.autoTagTitle")}
                  onClick={() => {
                    const tag = prompt(t("b.zone.autoTagPrompt"), zone.autoTag ?? "");
                    if (tag === null) return;
                    useStore.getState().patchZone(zone.id, { autoTag: tag.trim() || null }).catch((e) => console.error(e));
                  }}
                >
                  #
                </ZoneChipButton>
                <ZoneChipButton
                  hue={zone.hue}
                  title={t("b.zone.cycleColor")}
                  onClick={() =>
                    useStore.getState().patchZone(zone.id, { hue: (zone.hue + 47) % 360 }).catch((e) => console.error(e))
                  }
                >
                  ◐
                </ZoneChipButton>
                <ZoneChipButton
                  hue={zone.hue}
                  title={t("b.zone.focusTitle")}
                  onClick={() => {
                    const tasks = useStore.getState().tasks.filter(
                      (t) =>
                        t.x + CARD_W / 2 >= zone.x &&
                        t.x + CARD_W / 2 <= zone.x + zone.w &&
                        t.y + CARD_H / 2 >= zone.y &&
                        t.y + CARD_H / 2 <= zone.y + zone.h &&
                        !t.done && !t.archivedAt && !t.inbox,
                    );
                    if (tasks.length) useStore.getState().startFocus(tasks.map((t) => t.id));
                  }}
                >
                  ▶
                </ZoneChipButton>
                <ZoneChipButton
                  hue={zone.hue}
                  title={t("b.zone.deleteTitle")}
                  onClick={() => {
                    if (confirm(t("b.zone.deleteConfirm", { label: zone.label || t("b.zone.default") }))) {
                      useStore.getState().removeZone(zone.id).catch((e) => console.error(e));
                    }
                  }}
                >
                  ×
                </ZoneChipButton>
              </span>
            )}
          </div>

          {/* Resize handle */}
          {!readOnly && (
            <div
              className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full cursor-nwse-resize"
              style={{ background: `hsla(${zone.hue}, 70%, 60%, 0.5)` }}
              onPointerDown={(e) => startDrag(e, zone, "resize")}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              title={t("b.zone.resize")}
            />
          )}
        </div>
      ))}
    </>
  );
}

function ZoneChipButton({
  hue, title, onClick, children,
}: { hue: number; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="w-6 h-6 rounded-full bg-[#1a1d24] text-[11px] text-gray-400 hover:text-white transition-colors"
      style={{ border: `1.5px solid hsla(${hue}, 70%, 60%, 0.4)` }}
      title={title}
    >
      {children}
    </button>
  );
}
