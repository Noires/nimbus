import type { CardDensity } from "../engine/semanticDensity";

export const DENSITY_PREFERENCE_KEY = "nimbus:card-density";

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readDensityPreference(storage: StorageReader | null = browserStorage()): CardDensity {
  try {
    const value = storage?.getItem(DENSITY_PREFERENCE_KEY);
    return value === "compact" || value === "high" || value === "normal" ? value : "normal";
  } catch {
    return "normal";
  }
}

export function saveDensityPreference(density: CardDensity, storage: StorageWriter | null = browserStorage()): void {
  try {
    storage?.setItem(DENSITY_PREFERENCE_KEY, density);
  } catch {
    // The visual preference is optional: private-browsing failures stay local.
  }
}
