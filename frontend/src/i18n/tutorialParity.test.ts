import { describe, expect, it } from "vitest";
import { deD, enD } from "./fragments/d";

describe("tutorial locale parity", () => {
  it("keeps every tutorial key in English and German", () => {
    const en = Object.keys(enD).filter((key) => key.startsWith("tutorial.")).sort();
    const de = Object.keys(deD).filter((key) => key.startsWith("tutorial.")).sort();
    expect(de).toEqual(en);
  });
});