import { describe, expect, it, vi } from "vitest";
import {
  DENSITY_PREFERENCE_KEY,
  readDensityPreference,
  saveDensityPreference,
} from "./densityPreference";

describe("densityPreference", () => {
  it("defaults to normal without a client-side preference", () => {
    expect(readDensityPreference({ getItem: () => null })).toBe("normal");
    expect(readDensityPreference({ getItem: () => "mini" })).toBe("normal");
  });

  it("reads and writes only the local density preference", () => {
    const setItem = vi.fn();
    expect(readDensityPreference({ getItem: (key) => key === DENSITY_PREFERENCE_KEY ? "high" : null })).toBe("high");
    saveDensityPreference("compact", { setItem });
    expect(setItem).toHaveBeenCalledWith(DENSITY_PREFERENCE_KEY, "compact");
  });
});
