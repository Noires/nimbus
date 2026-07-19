import { useEffect } from "react";
import { CLIENT_ID } from "./api";
import { useStore, type RemoteEvent } from "../store";

// Live Wire: subscribe to the canvas SSE stream and fold remote mutations
// into the store. Own echoes (same CLIENT_ID) are dropped; EventSource
// auto-reconnects, and we refetch after a gap so nothing is missed.
export function useLiveSync(canvasId: string | null) {
  useEffect(() => {
    if (!canvasId || useStore.getState().readOnly) return;

    const source = new EventSource(`/api/canvases/${canvasId}/stream`);
    let hadError = false;

    source.onopen = () => {
      useStore.getState().setLiveConnected(true);
      if (hadError) {
        hadError = false;
        // Reconnected after a gap — resync everything canvas-scoped.
        const store = useStore.getState();
        store.refreshTasks(canvasId).catch(() => {});
        store.loadBubbles(canvasId).catch(() => {});
        store.loadDependencies(canvasId).catch(() => {});
        store.loadPortals(canvasId).catch(() => {});
        store.loadZones(canvasId).catch(() => {});
        store.loadConnections(canvasId).catch(() => {});
      }
    };

    source.onerror = () => {
      hadError = true;
      useStore.getState().setLiveConnected(false);
    };

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as RemoteEvent & { clientId?: string };
        if (event.clientId === CLIENT_ID) return; // own echo
        useStore.getState().applyRemote(event);
      } catch (e) {
        console.error("bad SSE payload", e);
      }
    };

    return () => {
      source.close();
      useStore.getState().setLiveConnected(false);
    };
  }, [canvasId]);
}
