import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../store";
import { Canvas } from "./Canvas";
import { Toast } from "./Toast";
import { useT } from "../i18n";
import { IconEye } from "./ui/icons";

// Read-only board via /share/:token — the full living canvas (pan, zoom,
// lenses via nothing to toggle here, bubbles, threads, zones) with every
// mutation surface gone.
export function ShareView() {
  const params = useParams();
  const t = useT();
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; name?: string; canvasId?: string }>({
    status: "loading",
  });

  useEffect(() => {
    const token = params.token;
    if (!token) return;
    useStore.setState({ readOnly: true });
    useStore
      .getState()
      .loadSharedSnapshot(token)
      .then((name) => {
        const canvasId = useStore.getState().tasks[0]?.canvasId ?? "shared";
        setState({ status: "ready", name, canvasId });
      })
      .catch(() => setState({ status: "error" }));
  }, [params.token]);

  if (state.status === "loading") {
    return <div className="h-screen w-screen bg-nc-well flex items-center justify-center text-nc-faint text-sm">{t("c.share.loading")}</div>;
  }
  if (state.status === "error") {
    return (
      <div className="h-screen w-screen bg-nc-well flex flex-col items-center justify-center gap-2">
        <div className="text-nc-danger text-sm">{t("c.share.error")}</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-nc-well text-nc-text font-sans relative">
      <div className="absolute top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-1.5 bg-nc-accent-surface/60 border-b border-nc-accent-border backdrop-blur-sm">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: "radial-gradient(circle, var(--nc-accent), var(--nc-select-surface))", boxShadow: "0 0 10px 2px color-mix(in srgb, var(--nc-accent) 60%, transparent)" }}
        />
        <span className="text-xs font-semibold text-nc-text">{t("app.name")}</span>
        <span className="text-xs text-nc-faint">·</span>
        <span className="inline-flex items-center gap-1 text-xs text-nc-accent"><IconEye size={16} />{t("c.share.viewOnly")}</span>
        <span className="text-xs text-nc-soft">·</span>
        <span className="text-xs text-nc-text">{state.name}</span>
      </div>
      <Canvas canvasId={state.canvasId!} semanticDensity="normal" onCreateAt={() => {}} onEditTask={() => {}} />
      <Toast />
    </div>
  );
}
