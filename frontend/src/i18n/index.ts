import { create } from "zustand";
import { enA, deA } from "./fragments/a";
import { enB, deB } from "./fragments/b";
import { enC, deC } from "./fragments/c";
import { enD, deD } from "./fragments/d";

// Lightweight i18n: flat key → string dictionaries per locale, merged from
// per-area fragment files. `t()` is callable anywhere (store actions, module
// functions); components use `useT()` so they re-render on locale switch.
// Production retains English fallback for legacy surfaces. Tests can opt into
// strict lookup so a missing changed-flow key fails CI instead of silently
// rendering fallback copy.

export type Locale = "en" | "de";

declare global {
  // Runtime-configurable so Vitest can verify both dictionaries without
  // changing production behavior.
  // eslint-disable-next-line no-var
  var __NIMBUS_STRICT_I18N__: boolean | undefined;
}

const dictionaries: Record<Locale, Record<string, string>> = {
  en: { ...enA, ...enB, ...enC, ...enD },
  de: { ...deA, ...deB, ...deC, ...deD },
};

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
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

export function t(key: string, vars?: Record<string, string | number>, localeOverride?: Locale): string {
  const locale = localeOverride ?? useLocale.getState().locale;
  const localeText = dictionaries[locale][key];
  const englishText = dictionaries.en[key];
  if (globalThis.__NIMBUS_STRICT_I18N__ && (!localeText || !englishText)) {
    throw new Error(`Missing ${locale} translation: ${key}`);
  }
  let text = localeText ?? englishText ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Test-only guard for rendering changed EN/DE flows without fallback. */
export function setStrictI18nForTests(enabled: boolean) {
  globalThis.__NIMBUS_STRICT_I18N__ = enabled;
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
