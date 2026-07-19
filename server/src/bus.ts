import { EventEmitter } from "events";

// In-memory per-canvas event bus for SSE live sync. Single-process by design;
// swapping in Redis pub/sub later only changes this file.
export interface LiveEvent {
  entity: "task" | "bubble" | "dependency" | "portal" | "zone" | "canvas" | "connection";
  action: "upsert" | "delete";
  data: unknown;
  clientId?: string;
}

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function publish(canvasId: string, event: LiveEvent) {
  bus.emit(canvasId, event);
}

export function subscribe(canvasId: string, listener: (event: LiveEvent) => void): () => void {
  bus.on(canvasId, listener);
  return () => bus.off(canvasId, listener);
}
