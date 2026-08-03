export type CanvasDestination = "canvas" | "inbox" | "today" | "review" | "operations" | "ledger";

const destinations: ReadonlyArray<Exclude<CanvasDestination, "canvas">> = ["inbox", "today", "review", "operations", "ledger"];

export function canvasDestinationFromPath(pathname: string, canvasId: string): CanvasDestination {
  const prefix = `/canvas/${encodeURIComponent(canvasId)}`;
  if (pathname === prefix || pathname === `${prefix}/`) return "canvas";
  const segment = pathname.slice(prefix.length).split("/").filter(Boolean)[0];
  return destinations.includes(segment as Exclude<CanvasDestination, "canvas">)
    ? segment as CanvasDestination
    : "canvas";
}

export function canvasPathForDestination(canvasId: string, destination: CanvasDestination): string {
  const prefix = `/canvas/${encodeURIComponent(canvasId)}`;
  return destination === "canvas" ? prefix : `${prefix}/${destination}`;
}
