import { describe, expect, it } from "vitest";
import { deA, enA } from "./fragments/a";
import { deB, enB } from "./fragments/b";
import { deC, enC } from "./fragments/c";
import { deD, enD } from "./fragments/d";

const en = { ...enA, ...enB, ...enC, ...enD };
const de = { ...deA, ...deB, ...deC, ...deD };

describe("EN/DE dictionary parity", () => {
  it("has exactly the same keys, preventing silent English fallback", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });
});
