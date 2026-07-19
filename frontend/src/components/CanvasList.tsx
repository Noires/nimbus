import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore, type Canvas } from "../store";
import { useT } from "../i18n";

interface CanvasListProps {
  canvases: Canvas[];
  canvasId: string | null;
}

export function CanvasList({ canvases, canvasId }: CanvasListProps) {
  const t = useT();
  const [isExpanded, setIsExpanded] = useState(true);
  const navigate = useNavigate();

  const handleCreateCanvas = async () => {
    const name = prompt(t("a.canvasList.promptNew"));
    if (!name) return;
    try {
      const canvas = await useStore.getState().createCanvas(name);
      navigate(`/canvas/${canvas.id}`);
    } catch (e) {
      console.error(e);
      alert(t("a.canvasList.createFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-wider text-gray-500 font-semibold px-2">
          {t("a.canvasList.heading")}
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      {isExpanded && (
        <nav className="flex flex-col gap-1">
          <button
            onClick={handleCreateCanvas}
            className="w-full px-3 py-2 rounded-lg border border-dashed border-white/15 text-gray-400 hover:text-white hover:border-white/30 transition-all text-sm"
          >
            {t("a.canvasList.new")}
          </button>

          <div className="mt-2">
            {canvases.map((canvas) => {
              const isActive = canvas.id === canvasId;
              return (
                <div
                  key={canvas.id}
                  className={`group flex items-center rounded-md transition-colors ${
                    isActive ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <Link
                    to={`/canvas/${canvas.id}`}
                    className={`flex-1 min-w-0 truncate px-3 py-1.5 text-sm transition-colors ${
                      isActive ? "text-white font-medium" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {canvas.name || t("a.canvasList.untitled")}
                  </Link>
                  <button
                    onClick={async () => {
                      const name = prompt(t("a.canvasList.promptRename"), canvas.name);
                      if (!name || name === canvas.name) return;
                      await useStore.getState().renameCanvas(canvas.id, name).catch((e) => {
                        console.error(e);
                        alert(t("a.canvasList.renameFailed"));
                      });
                    }}
                    className="opacity-0 group-hover:opacity-100 px-1 text-xs text-gray-500 hover:text-white transition-all"
                    title={t("a.canvasList.renameTitle")}
                  >
                    ✎
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(t("a.canvasList.confirmDelete", { name: canvas.name }))) return;
                      try {
                        await useStore.getState().deleteCanvas(canvas.id);
                        if (canvas.id === canvasId) {
                          const rest = useStore.getState().canvases;
                          navigate(rest[0] ? `/canvas/${rest[0].id}` : "/", { replace: true });
                        }
                      } catch (e) {
                        console.error(e);
                        alert(t("a.canvasList.deleteFailed"));
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 px-1.5 text-xs text-gray-500 hover:text-red-400 transition-all"
                    title={t("a.canvasList.deleteTitle")}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
