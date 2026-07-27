import { describe, expect, it } from "vitest";
import {
  SPATIAL_COMMAND_CENTER_SHELL_FLAG,
  readSpatialCommandCenterShellFlag,
} from "./spatialCommandCenterFlag";

describe("readSpatialCommandCenterShellFlag", () => {
  it("defaults to the legacy shell when no persisted opt-in exists", () => {
    expect(readSpatialCommandCenterShellFlag({ getItem: () => null })).toBe(false);
  });

  it("enables only for the explicit persisted opt-in", () => {
    expect(readSpatialCommandCenterShellFlag({
      getItem: (key) => (key === SPATIAL_COMMAND_CENTER_SHELL_FLAG ? "true" : null),
    })).toBe(true);
  });

  it("fails closed when storage cannot be read", () => {
    expect(readSpatialCommandCenterShellFlag({
      getItem: () => {
        throw new Error("storage unavailable");
      },
    })).toBe(false);
  });
});
