import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../store";
import { Canvas } from "./Canvas";
import { Toast } from "./Toast";
import { useT } from "../i18n";

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
    return <div className="h-screen w-screen bg-[#0f0f13] flex items-center justify-center text-gray-500 text-sm">{t("c.share.loading")}</div>;
  }
  if (state.status === "error") {
    return (
      <div className="h-screen w-screen bg-[#0f0f13] flex flex-col items-center justify-center gap-2">
        <div className="text-red-400 text-sm">{t("c.share.error")}</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0f0f13] text-gray-100 font-sans relative">
      <div className="absolute top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-1.5 bg-cyan-950/60 border-b border-cyan-500/30 backdrop-blur-sm">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: "radial-gradient(circle, #67e8f9, #6366f1)", boxShadow: "0 0 10px 2px rgba(103,232,249,0.6)" }}
        />
        <span className="text-xs font-semibold text-gray-100">{t("app.name")}</span>
        <span className="text-xs text-gray-500">·</span>
        <span className="text-xs text-cyan-300">👁 {t("c.share.viewOnly")}</span>
        <span className="text-xs text-gray-300">·</span>
        <span className="text-xs text-gray-200">{state.name}</span>
      </div>
      <Canvas canvasId={state.canvasId!} onCreateAt={() => {}} onEditTask={() => {}} />
      <Toast />
    </div>
  );
}
