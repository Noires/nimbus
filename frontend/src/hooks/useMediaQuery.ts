import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, fallback: boolean): boolean {
  // jsdom test environments may lack matchMedia entirely — fall back instead
  // of crashing the component under test.
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";

  const subscribe = (onStoreChange: () => void) => {
    if (!supported) return () => {};

    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener("change", onStoreChange);
    return () => mediaQuery.removeEventListener("change", onStoreChange);
  };

  const getSnapshot = () => (supported ? window.matchMedia(query).matches : fallback);

  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}
