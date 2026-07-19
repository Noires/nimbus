import { create } from "zustand";
import { enA, deA } from "./fragments/a";
import { enB, deB } from "./fragments/b";
import { enC, deC } from "./fragments/c";
import { enD, deD } from "./fragments/d";

// Lightweight i18n: flat key → string dictionaries per locale, merged from
// per-area fragment files. `t()` is callable anywhere (store actions, module
// functions); components use `useT()` so they re-render on locale switch.
// Missing keys fall back English → key, so partial dictionaries never crash.

export type Locale = "en" | "de";

const dictionaries: Record<Locale, Record<string, string>> = {
  en: { ...enA, ...enB, ...enC, ...enD },
  de: { ...deA, ...deB, ...deC, ...deD },
};

function detectLocale(): Locale {
  const saved = localStorage.getItem("locale");
  if (saved === "en" || saved === "de") return saved;
  return navigator.language?.toLowerCase().startsWith("de") ? "de" : "en";
}

export const useLocale = create<{ locale: Locale; setLocale: (locale: Locale) => void }>((set) => ({
  locale: detectLocale(),
  setLocale: (locale) => {
    localStorage.setItem("locale", locale);
    set({ locale });
  },
}));

export function t(key: string, vars?: Record<string, string | number>): string {
  const { locale } = useLocale.getState();
  let text = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Hook variant: subscribes to the locale so the component re-renders on switch. */
export function useT(): typeof t {
  useLocale((s) => s.locale);
  return t;
}

/** Current locale string for toLocaleDateString etc. */
export function dateLocale(): string {
  return useLocale.getState().locale === "de" ? "de-DE" : "en-US";
}
