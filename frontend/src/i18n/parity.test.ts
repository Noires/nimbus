import { afterEach, describe, expect, it } from "vitest";
import { deA, enA } from "./fragments/a";
import { deB, enB } from "./fragments/b";
import { deC, enC } from "./fragments/c";
import { deD, enD } from "./fragments/d";
import { setStrictI18nForTests, t, useLocale } from "./index";

const en = { ...enA, ...enB, ...enC, ...enD };
const de = { ...deA, ...deB, ...deC, ...deD };

describe("EN/DE dictionary parity", () => {
  afterEach(() => setStrictI18nForTests(false));

  it("has exactly the same keys, preventing silent English fallback", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it("fails test-mode lookup rather than hiding a missing locale key with fallback", () => {
    setStrictI18nForTests(true);
    useLocale.setState({ locale: "de" });
    expect(() => t("command-center.key-that-does-not-exist")).toThrow("Missing de translation");
    useLocale.setState({ locale: "en" });
  });
});
