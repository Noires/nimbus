import { describe, expect, it } from "vitest";
import { arrangementRevision, isArrangementPreviewCurrent, previewArrangementOperation, type ArrangementTask } from "./arrangementOperation";

const task = (id: string, x: number, y: number): ArrangementTask => ({ id, x, y });

function overlappingTasks(count: number): ArrangementTask[] {
  return Array.from({ length: count }, (_, index) => task(`task-${String(index).padStart(4, "0")}`, 0, 0));
}

describe("previewArrangementOperation", () => {
  it("deterministically returns a non-mutating tidy preview with exact inverse positions", () => {
    const tasks = [task("b", 0, 0), task("a", 0, 0), task("unscoped", 0, 0)];
    const input = { scope: { kind: "selected" as const, taskIds: ["b", "a"] }, tasks };

    const first = previewArrangementOperation(input);
    const second = previewArrangementOperation(input);

    expect(first).toEqual(second);
    expect(tasks).toEqual([task("b", 0, 0), task("a", 0, 0), task("unscoped", 0, 0)]);
    expect(first.moved.map((move) => move.id)).toEqual(["b"]);
    expect(first.unchanged).toEqual(["a"]);
    expect(first.inverse).toEqual([
      { id: "b", x: 0, y: 0 },
    ]);
    expect(first.explanation).toContain("2");
  });

  it("skips a protected scope and task members of pinned or protected workstreams", () => {
    const tasks = [task("free", 0, 0), task("pinned-member", 0, 0), task("protected-member", 0, 0)];
    const protectedScope = previewArrangementOperation({
      scope: { kind: "workstream", workstreamId: "protected", taskIds: ["free"] },
      tasks,
      workstreams: [{ id: "protected", pinned: false, protected: true, taskIds: ["free"] }],
    });
    const mixedScope = previewArrangementOperation({
      scope: { kind: "selected", taskIds: tasks.map((item) => item.id) },
      tasks,
      workstreams: [
        { id: "pinned", pinned: true, protected: false, taskIds: ["pinned-member"] },
        { id: "guarded", pinned: false, protected: true, taskIds: ["protected-member"] },
      ],
    });

    expect(protectedScope.moved).toEqual([]);
    expect(protectedScope.skipped).toEqual([{ id: "protected", reason: "protected-workstream" }]);
    expect(mixedScope.skipped).toEqual([
      { id: "pinned-member", reason: "pinned-workstream" },
      { id: "protected-member", reason: "protected-workstream" },
    ]);
    expect(mixedScope.unchanged).toEqual(["free"]);
  });

  it("honors caller-supplied selection and protected task ids without moving skipped candidates", () => {
    const tasks = [task("a", 0, 0), task("b", 0, 0), task("protected", 0, 0), task("outside", 0, 0)];

    const preview = previewArrangementOperation({
      scope: { kind: "selected", taskIds: ["b", "missing", "protected", "a", "a"] },
      tasks,
      protectedTaskIds: ["protected"],
    });

    expect(preview.moved.map((move) => move.id)).toEqual(["b"]);
    expect(preview.unchanged).toEqual(["a"]);
    expect(preview.skipped).toEqual([
      { id: "missing", reason: "missing-task" },
      { id: "protected", reason: "protected-task" },
    ]);
    expect(preview.inverse).toEqual([{ id: "b", x: 0, y: 0 }]);
    expect(preview.isNoop).toBe(false);
    expect(preview.explanations).toContain("Skipped 2 selected cards.");
  });

  it("previews explicit arrange modes without persistence and keeps protected items fixed", () => {
    const tasks = [
      { ...task("b", 0, 0), title: "same", tags: ["z", "a"], priority: "medium", status: "open", dueDate: "2026-08-02" },
      { ...task("a", 0, 0), title: "same", tags: ["a", "z"], priority: "medium", status: "open", dueDate: "2026-08-02" },
      { ...task("protected", 0, 0), title: "fixed", tags: ["a"], priority: "high", status: "open", dueDate: "2026-08-02" },
    ];
    const preview = previewArrangementOperation({
      scope: { kind: "canvas", taskIds: ["protected", "b", "a"] }, tasks, strategy: "tag", protectedTaskIds: ["protected"],
    });
    expect(preview.strategy).toBe("tag");
    expect(preview.skipped).toEqual([{ id: "protected", reason: "protected-task" }]);
    expect(tasks.map(({ id, x, y }) => ({ id, x, y }))).toEqual([task("b", 0, 0), task("a", 0, 0), task("protected", 0, 0)]);
    expect(preview.moved.map((move) => move.id)).toEqual(["a", "b"]);
  });

  it("reports an explicit no-op when eligible candidates do not overlap", () => {
    const preview = previewArrangementOperation({
      scope: { kind: "canvas", taskIds: ["a", "b"] },
      tasks: [task("a", 0, 0), task("b", 1000, 1000)],
    });

    expect(preview).toMatchObject({
      moved: [],
      unchanged: ["a", "b"],
      skipped: [],
      positions: [],
      inverse: [],
      isNoop: true,
    });
    expect(preview.explanation).toContain("No overlapping");
    expect(preview.explanations).toEqual([preview.explanation]);
  });

  it("binds a preview to its scope, positions, protections, and revision", () => {
    const tasks = [task("a", 0, 0), task("b", 0, 0)];
    const workstreams = [{ id: "ws", pinned: false, protected: false, taskIds: ["a", "b"] }];
    const preview = previewArrangementOperation({
      scope: { kind: "workstream", workstreamId: "ws", taskIds: ["a", "b"] },
      tasks,
      workstreams,
      revision: arrangementRevision(tasks, workstreams),
    });

    expect(isArrangementPreviewCurrent(preview, tasks, workstreams)).toBe(true);
    expect(isArrangementPreviewCurrent(preview, [task("a", 0, 0), task("b", 30, 0)], workstreams)).toBe(false);
    expect(isArrangementPreviewCurrent(preview, tasks, [{ ...workstreams[0], pinned: true }])).toBe(false);
    expect(isArrangementPreviewCurrent(preview, tasks, [{ ...workstreams[0], taskIds: ["a"] }])).toBe(false);
  });

  it("packs only unambiguous selected-zone tasks and goes stale on zone geometry", () => {
    const zones = [
      { id: "zone-a", canvasId: "canvas", x: 0, y: 0, w: 800, h: 400, label: "A", hue: 0, autoTag: null, z: 0 },
      { id: "zone-overlap", canvasId: "canvas", x: 100, y: 0, w: 400, h: 400, label: "B", hue: 0, autoTag: null, z: 0 },
      { id: "zone-small", canvasId: "canvas", x: 1000, y: 0, w: 100, h: 100, label: "Small", hue: 0, autoTag: null, z: 0 },
    ] as any;
    const tasks = [task("outside", 2000, 0), task("small", 920, 0), task("ambiguous", 50, 0)];
    const preview = previewArrangementOperation({ scope: { kind: "selected-zones", taskIds: tasks.map(({ id }) => id) }, tasks, zones });
    expect(preview.skipped).toEqual(expect.arrayContaining([
      { id: "outside", reason: "outside-zone" }, { id: "small", reason: "zone-too-small", zoneIds: ["zone-small"] },
      { id: "ambiguous", reason: "ambiguous-zone", zoneIds: ["zone-a", "zone-overlap"] },
    ]));
    expect(isArrangementPreviewCurrent(preview, tasks, [], zones)).toBe(true);
    expect(isArrangementPreviewCurrent(preview, tasks, [], [{ ...zones[0], x: 1 }, ...zones.slice(1)])).toBe(false);
  });

  it("keeps every zone-arranged card fully contained and skips deterministic overflow", () => {
    const zones = [{ id: "zone", canvasId: "canvas", x: 10, y: 20, w: 300, h: 170, label: "Zone", hue: 0, autoTag: null, z: 0 }] as any;
    // All card centres start in the Zone, but it has capacity for only one full card.
    const tasks = [task("b", 20, 30), task("a", 30, 40)];
    const preview = previewArrangementOperation({ scope: { kind: "selected-zones", taskIds: ["b", "a"] }, tasks, zones });
    expect(preview.moved).toEqual([{ id: "b", x: 10, y: 20, zoneId: "zone" }]);
    expect(preview.skipped).toEqual([{ id: "a", reason: "zone-too-small", zoneIds: ["zone"] }]);
    for (const move of preview.moved) {
      expect(move.x).toBeGreaterThanOrEqual(zones[0].x);
      expect(move.y).toBeGreaterThanOrEqual(zones[0].y);
      expect(move.x + 256).toBeLessThanOrEqual(zones[0].x + zones[0].w);
      expect(move.y + 170).toBeLessThanOrEqual(zones[0].y + zones[0].h);
    }
  });

  it.each([100, 500, 1000])("previews %i overlapping cards without mutation", (count) => {
    const tasks = overlappingTasks(count);
    const started = performance.now();
    const result = previewArrangementOperation({
      scope: { kind: "canvas", taskIds: tasks.map((item) => item.id) },
      tasks,
    });

    expect(result.moved).toHaveLength(count - 1);
    expect(tasks.every((item) => item.x === 0 && item.y === 0)).toBe(true);
    expect(performance.now() - started).toBeLessThan(2500);
  });
});
