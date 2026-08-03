export const MOBILE_COMMAND_CENTER_QUERY = "(max-width: 768px)";

export type MobileCommandViewport = "narrow" | "wide";
export type MobileCommandDestination = "capture" | "inbox" | "today" | "review" | "operations" | "more" | "inspector";

const MOBILE_DESTINATIONS: ReadonlySet<MobileCommandDestination> = new Set<MobileCommandDestination>([
  "capture",
  "inbox",
  "today",
  "review",
  "operations",
  "more",
  "inspector",
]);

export function isMobileCommandCenterEnabled(viewport: MobileCommandViewport): boolean {
  return viewport === "narrow";
}

export function resolveMobileCommandDestination(destination: string | undefined): MobileCommandDestination {
  return destination && MOBILE_DESTINATIONS.has(destination as MobileCommandDestination)
    ? destination as MobileCommandDestination
    : "capture";
}

export function openMobileInboxInspector<T>(
  task: T,
  selectTask: (task: T | null) => void,
  changeDestination: (destination: MobileCommandDestination) => void,
): void {
  selectTask(task);
  changeDestination("inspector");
}
