import { describe, expect, it } from "vitest";
import { selectLedgerTasks } from "./LedgerView";
import type { Task } from "../data/api";

const task = (id: string, title: string, dueDate: string | null, priority = "medium"): Task => ({
  id, canvasId: "canvas", x: 0, y: 0, z: 0, title, description: "", tags: [], color: "#000", dueDate,
  priority, done: false, archivedAt: null, createdAt: "2026-01-01T00:00:00.000Z", inbox: false,
  snoozedUntil: null, estimateMinutes: null, recurrence: null, lastActivityAt: "2026-01-01T00:00:00.000Z", actualMinutes: 0,
  provider: null, connectionId: null, externalKey: null, externalUrl: null, status: null, externalMeta: null, syncedAt: null, checklist: [],
});

describe("selectLedgerTasks", () => {
  it("uses local date strings and immutable ids as deterministic final ties", () => {
    const result = selectLedgerTasks([task("b", "Same", "2026-08-03T00:00:00.000Z"), task("a", "Same", "2026-08-03T00:00:00.000Z"), task("z", "Later", null)], { sort: "dueDate", direction: "asc" });
    expect(result.map((item) => item.id)).toEqual(["a", "b", "z"]);
  });
  it("filters only current matching task records", () => {
    const done = task("done", "Done", null); done.done = true;
    const open = task("open", "Open", null); open.tags = ["work"];
    expect(selectLedgerTasks([done, open], { done: false, tag: "work" }).map((item) => item.id)).toEqual(["open"]);
  });
});
