import { describe, expect, it } from "vitest";
import { computeAutoArrange } from "./autoArrange";

const task = (id: string, overrides: Partial<{
  x: number; y: number; title: string; tags: string[]; priority: string; status: string | null; dueDate: string | null;
}> = {}) => ({
  id, x: 0, y: 0, title: "same", tags: [], priority: "medium", status: null, dueDate: null, ...overrides,
});

describe("computeAutoArrange", () => {
  it("uses deterministic sorted tags and immutable IDs as its final ordering tie-break", () => {
    const now = new Date(2026, 7, 2, 12);
    const first = computeAutoArrange([
      task("b", { tags: ["z", "a"] }), task("a", { tags: ["a", "z"] }),
    ], "tag", now);
    const second = computeAutoArrange([
      task("a", { tags: ["z", "a"] }), task("b", { tags: ["a", "z"] }),
    ], "tag", now);
    expect(first.groups).toEqual([{ key: "a", memberIds: ["a", "b"] }]);
    expect([...first.moves]).toEqual([...second.moves]);
  });

  it("groups due dates by the local calendar date, including date-only values", () => {
    const now = new Date(2026, 7, 2, 23, 30);
    const result = computeAutoArrange([
      task("today", { dueDate: "2026-08-02" }),
      task("week", { dueDate: "2026-08-09" }),
      task("later", { dueDate: "2026-08-10" }),
    ], "due", now);
    expect(result.groups.map((group) => group.key)).toEqual(["today", "week", "later"]);
  });
});
