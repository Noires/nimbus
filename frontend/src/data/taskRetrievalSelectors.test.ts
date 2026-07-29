import { describe, expect, it } from "vitest";
import type { Task } from "./api";
import { selectTaskRetrievalResults } from "./taskRetrievalSelectors";

function task(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  const { id, title, ...rest } = overrides;

  return {
    id,
    canvasId: "canvas-1",
    x: 0,
    y: 0,
    z: 0,
    title,
    description: "",
    tags: [],
    color: "#6366f1",
    dueDate: null,
    priority: "medium",
    done: false,
    archivedAt: null,
    createdAt: "2026-07-29T00:00:00.000Z",
    inbox: false,
    snoozedUntil: null,
    estimateMinutes: null,
    recurrence: null,
    lastActivityAt: "2026-07-29T00:00:00.000Z",
    actualMinutes: 0,
    provider: null,
    connectionId: null,
    externalKey: null,
    externalUrl: null,
    status: null,
    externalMeta: null,
    syncedAt: null,
    checklist: [],
    ...rest,
  };
}

describe("selectTaskRetrievalResults", () => {
  it("normalizes query and titles, excludes archived tasks, and returns no results for blank input", () => {
    const tasks = [
      task({ id: "decomposed", title: "Cafe\u0301 notes" }),
      task({ id: "archived", title: "Café archive", archivedAt: "2026-07-29T00:00:00.000Z" }),
      task({ id: "other", title: "Plan release" }),
    ];

    expect(selectTaskRetrievalResults({ tasks, query: "  CAFÉ  " }).map((candidate) => candidate.id)).toEqual(["decomposed"]);
    expect(selectTaskRetrievalResults({ tasks, query: "   " })).toEqual([]);
  });

  it("orders exact matches, then prefixes, then substrings, normalized titles, and ids without locale collation", () => {
    const tasks = [
      task({ id: "z-prefix", title: "alpha zebra" }),
      task({ id: "z-substring", title: "Zebra alpha" }),
      task({ id: "b-substring", title: "Beta alpha" }),
      task({ id: "id-b", title: "ALPHA" }),
      task({ id: "id-a", title: "alpha" }),
      task({ id: "a-prefix", title: "Alpha aardvark" }),
    ];

    expect(selectTaskRetrievalResults({ tasks, query: "alpha" }).map((candidate) => candidate.id)).toEqual([
      "id-a",
      "id-b",
      "a-prefix",
      "z-prefix",
      "b-substring",
      "z-substring",
    ]);
  });

  it("applies the requested result bound after deterministic ordering", () => {
    const tasks = [
      task({ id: "second", title: "needle two" }),
      task({ id: "first", title: "needle one" }),
      task({ id: "third", title: "needle three" }),
    ];

    expect(selectTaskRetrievalResults({ tasks, query: "needle", limit: 2 }).map((candidate) => candidate.id)).toEqual([
      "first",
      "third",
    ]);
  });
});
