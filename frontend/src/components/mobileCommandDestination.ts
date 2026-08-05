export const MOBILE_COMMAND_CENTER_QUERY = "(max-width: 768px)";

export type MobileCommandViewport = "narrow" | "wide";
// Mobile is an operational companion, not a compressed desktop rail. Capture
// stays in the app bar; the four stable tabs are Today, Inbox, Canvas and More.
export type MobileCommandDestination = "canvas" | "inbox" | "today" | "more" | "review" | "operations" | "ledger" | "inspector" | "capture";

const MOBILE_DESTINATIONS: ReadonlySet<MobileCommandDestination> = new Set<MobileCommandDestination>([
  "canvas",
  "inbox",
  "today",
  "more",
  "review",
  "operations",
  "ledger",
  "inspector",
  "capture",
]);

export function isMobileCommandCenterEnabled(viewport: MobileCommandViewport): boolean {
  return viewport === "narrow";
}

export function resolveMobileCommandDestination(destination: string | undefined): MobileCommandDestination {
  return destination && MOBILE_DESTINATIONS.has(destination as MobileCommandDestination)
    ? destination as MobileCommandDestination
    : "today";
}

export function openMobileInboxInspector<T>(
  task: T,
  selectTask: (task: T | null) => void,
  changeDestination: (destination: MobileCommandDestination) => void,
): void {
  selectTask(task);
  changeDestination("inspector");
}
