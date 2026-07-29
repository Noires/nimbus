import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, fallback: boolean): boolean {
  const subscribe = (onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => {};

    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener("change", onStoreChange);
    return () => mediaQuery.removeEventListener("change", onStoreChange);
  };

  const getSnapshot = () => (
    typeof window === "undefined" ? fallback : window.matchMedia(query).matches
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}
