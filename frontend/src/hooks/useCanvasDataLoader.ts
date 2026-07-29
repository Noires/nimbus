import { useEffect } from "react";
import { useStore } from "../store";
import type { InboxTriageState } from "../components/InboxTriage";

type CanvasDataLoaders = {
  refreshTasks: (canvasId: string) => Promise<void>;
  loadWorkstreams: (canvasId: string) => Promise<void>;
  loadBubbles: (canvasId: string) => Promise<void>;
  loadDependencies: (canvasId: string) => Promise<void>;
  loadPortals: (canvasId: string) => Promise<void>;
  loadZones: (canvasId: string) => Promise<void>;
  loadConnections: (canvasId: string) => Promise<void>;
};

export async function loadCanvasData(
  canvasId: string,
  loaders: CanvasDataLoaders,
  onState: (state: InboxTriageState) => void,
): Promise<void> {
  onState("loading");

  const optionalLoads = [
    loaders.loadBubbles(canvasId),
    loaders.loadDependencies(canvasId),
    loaders.loadPortals(canvasId),
    loaders.loadZones(canvasId),
    loaders.loadConnections(canvasId),
  ].map((load) => load.catch((error) => console.error(error)));

  try {
    await Promise.all([
      loaders.refreshTasks(canvasId),
      loaders.loadWorkstreams(canvasId),
      ...optionalLoads,
    ]);
    onState("ready");
  } catch (error) {
    onState("error");
    throw error;
  }
}

export function useCanvasDataLoader(
  canvasId: string | null,
  readOnly: boolean,
  onState: (state: InboxTriageState) => void,
): void {
  useEffect(() => {
    if (!canvasId || readOnly) return;

    const store = useStore.getState();
    void loadCanvasData(canvasId, store, onState).catch((error) => console.error(error));
  }, [canvasId, onState, readOnly]);
}
