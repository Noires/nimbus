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
