import { describe, expect, it } from "vitest";
import {
  MOBILE_COMMAND_CENTER_QUERY,
  isMobileCommandCenterEnabled,
  openMobileInboxInspector,
  resolveMobileCommandDestination,
} from "./mobileCommandCenter";

describe("mobileCommandCenter", () => {
  it("enables the companion at the narrow breakpoint", () => {
    expect(MOBILE_COMMAND_CENTER_QUERY).toBe("(max-width: 768px)");
    expect(isMobileCommandCenterEnabled("narrow")).toBe(true);
    expect(isMobileCommandCenterEnabled("wide")).toBe(false);
  });

  it("keeps an explicit valid destination and only opens Capture for an invalid or absent destination", () => {
    expect(resolveMobileCommandDestination("inbox")).toBe("inbox");
    expect(resolveMobileCommandDestination("inspector")).toBe("inspector");
    expect(resolveMobileCommandDestination(undefined)).toBe("capture");
    expect(resolveMobileCommandDestination("invalid")).toBe("capture");
  });

  it("routes an Inbox inspector action to the selected task inspector", () => {
    const task = { id: "task-1", title: "Triage feedback" };
    const selectTask = (value: typeof task | null) => selected.push(value);
    const changeDestination = (value: string) => destinations.push(value);
    const selected: Array<typeof task | null> = [];
    const destinations: string[] = [];

    openMobileInboxInspector(task, selectTask, changeDestination);

    expect(selected).toEqual([task]);
    expect(destinations).toEqual(["inspector"]);
  });
});
