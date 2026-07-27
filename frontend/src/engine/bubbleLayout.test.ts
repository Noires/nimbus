import { describe, expect, it } from "vitest";
import {
  classifyDueDate,
  createLatticePositions,
  groupTasksForArrange,
  rectanglesOverlap,
  selectLayoutCandidates,
} from "./bubbleLayout";

describe("createLatticePositions", () => {
  it("places a single task at the requested origin", () => {
    expect(createLatticePositions({ x: 24, y: -12 }, 1)).toEqual([{ x: 24, y: -12 }]);
  });

  it("preserves the product's deterministic diamond lattice around the requested center", () => {
    expect(createLatticePositions({ x: 0, y: 0 }, 4)).toEqual([
      { x: 0, y: 0 },
      { x: -130, y: -185 },
      { x: 130, y: -185 },
      { x: 130, y: 185 },
    ]);
  });
});

describe("groupTasksForArrange", () => {
  it("orders normalized group labels and persisted task ids by Unicode code units", () => {
    const groups = groupTasksForArrange([
      { id: "group-ä", x: 0, y: 0, tags: ["ä"], status: null, priority: null, dueDate: null },
      { id: "group-z", x: 0, y: 0, tags: ["z"], status: null, priority: null, dueDate: null },
      { id: "ä", x: 0, y: 0, tags: ["same"], status: null, priority: null, dueDate: null },
      { id: "z", x: 0, y: 0, tags: ["same"], status: null, priority: null, dueDate: null },
    ], { mode: "tag" });

    expect(groups).toEqual([
      { key: "same", taskIds: ["z", "ä"] },
      { key: "z", taskIds: ["group-z"] },
      { key: "ä", taskIds: ["group-ä"] },
    ]);
  });

  it("uses the first stored tag, puts untagged tasks in No tag, and uses task id as the final tie-breaker", () => {
    const groups = groupTasksForArrange([
      { id: "z", x: 5, y: 1, tags: ["Beta", "Alpha"], status: null, priority: null, dueDate: null },
      { id: "b", x: 1, y: 3, tags: ["Alpha"], status: null, priority: null, dueDate: null },
      { id: "a", x: 1, y: 3, tags: ["Alpha"], status: null, priority: null, dueDate: null },
      { id: "none", x: 0, y: 0, tags: [], status: null, priority: null, dueDate: null },
    ], { mode: "tag" });

    expect(groups).toEqual([
      { key: "Alpha", taskIds: ["a", "b"] },
      { key: "Beta", taskIds: ["z"] },
      { key: "No tag", taskIds: ["none"] },
    ]);
  });

  it("uses the supplied status order and task id ordering without consulting positions", () => {
    const groups = groupTasksForArrange([
      { id: "z", x: -100, y: 200, tags: [], status: "Blocked", priority: null, dueDate: null },
      { id: "a", x: 500, y: -200, tags: [], status: "Todo", priority: null, dueDate: null },
      { id: "b", x: 0, y: 0, tags: [], status: "Todo", priority: null, dueDate: null },
      { id: "none", x: 0, y: 0, tags: [], status: null, priority: null, dueDate: null },
    ], { mode: "status", statusOrder: ["Todo", "Blocked"] });

    expect(groups).toEqual([
      { key: "Todo", taskIds: ["a", "b"] },
      { key: "Blocked", taskIds: ["z"] },
      { key: "No status", taskIds: ["none"] },
    ]);
  });

  it("uses the supplied priority order without assuming product priorities", () => {
    const groups = groupTasksForArrange([
      { id: "later", x: 0, y: 0, tags: [], status: null, priority: "P2", dueDate: null },
      { id: "first", x: 0, y: 0, tags: [], status: null, priority: "P0", dueDate: null },
      { id: "none", x: 0, y: 0, tags: [], status: null, priority: null, dueDate: null },
    ], { mode: "priority", priorityOrder: ["P0", "P2"] });

    expect(groups).toEqual([
      { key: "P0", taskIds: ["first"] },
      { key: "P2", taskIds: ["later"] },
      { key: "No priority", taskIds: ["none"] },
    ]);
  });

  it("classifies ISO due dates against the supplied timezone-aware date context", () => {
    expect(classifyDueDate("2026-07-26T07:00:00.000Z", {
      now: "2026-07-26T06:30:00.000Z",
      timeZone: "America/Los_Angeles",
    })).toBe("Tomorrow");
  });

  it("classifies null and empty due dates as No due date", () => {
    const context = { now: "2026-07-26T12:00:00.000Z", timeZone: "UTC" };

    expect(classifyDueDate(null, context)).toBe("No due date");
    expect(classifyDueDate("", context)).toBe("No due date");
  });

  it("classifies malformed and non-date due dates as Invalid due date", () => {
    const context = {
      now: "2026-07-26T12:00:00.000Z",
      timeZone: "UTC",
    };

    expect(classifyDueDate("not-a-date", context)).toBe("Invalid due date");
    expect(classifyDueDate("2026-02-30T12:00:00.000Z", context)).toBe("Invalid due date");
  });

  it("orders due-date groups from overdue through invalid dates", () => {
    const groups = groupTasksForArrange([
      { id: "invalid", x: 0, y: 0, tags: [], status: null, priority: null, dueDate: "not-a-date" },
      { id: "later", x: 0, y: 0, tags: [], status: null, priority: null, dueDate: "2026-08-03T12:00:00.000Z" },
      { id: "no-due-date", x: 0, y: 0, tags: [], status: null, priority: null, dueDate: null },
      { id: "week", x: 0, y: 0, tags: [], status: null, priority: null, dueDate: "2026-07-24T12:00:00.000Z" },
      { id: "tomorrow", x: 0, y: 0, tags: [], status: null, priority: null, dueDate: "2026-07-21T12:00:00.000Z" },
      { id: "today", x: 0, y: 0, tags: [], status: null, priority: null, dueDate: "2026-07-20T12:00:00.000Z" },
      { id: "overdue", x: 0, y: 0, tags: [], status: null, priority: null, dueDate: "2026-07-19T12:00:00.000Z" },
    ], {
      mode: "dueDate",
      dueDateContext: { now: "2026-07-20T12:00:00.000Z", timeZone: "UTC" },
    });

    expect(groups).toEqual([
      { key: "Overdue", taskIds: ["overdue"] },
      { key: "Today", taskIds: ["today"] },
      { key: "Tomorrow", taskIds: ["tomorrow"] },
      { key: "This week", taskIds: ["week"] },
      { key: "Later", taskIds: ["later"] },
      { key: "No due date", taskIds: ["no-due-date"] },
      { key: "Invalid due date", taskIds: ["invalid"] },
    ]);
  });
});

describe("selectLayoutCandidates", () => {
  const tasks = [
    { id: "free", x: 0, y: 0, tags: [], status: null, priority: null, dueDate: null },
    { id: "first-pinned", x: 1, y: 0, tags: [], status: null, priority: null, dueDate: null },
    { id: "second-pinned", x: 2, y: 0, tags: [], status: null, priority: null, dueDate: null },
  ];
  const pinnedBubbleMemberIds = [new Set(["first-pinned"]), new Set(["second-pinned", "other"])];

  it("excludes tasks in every pinned-bubble member-id set by default", () => {
    expect(selectLayoutCandidates(tasks, { pinnedBubbleMemberIds }).map((task) => task.id)).toEqual(["free"]);
  });

  it("includes pinned-bubble members when explicitly requested", () => {
    expect(selectLayoutCandidates(tasks, { pinnedBubbleMemberIds, includePinnedBubbles: true })
      .map((task) => task.id)).toEqual(["free", "first-pinned", "second-pinned"]);
  });
});

describe("rectanglesOverlap", () => {
  it("uses 8px of world-space padding and treats padded edge-touching as non-overlap", () => {
    expect(rectanglesOverlap(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 108, y: 0, width: 100, height: 100 },
    )).toBe(false);
  });

  it("returns true when rectangles positively intersect within the padded boundary", () => {
    expect(rectanglesOverlap(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 107, y: 0, width: 100, height: 100 },
    )).toBe(true);
  });
});
