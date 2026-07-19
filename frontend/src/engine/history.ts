import type { Task, TaskPatch } from "../data/api";

// Inverse-operation undo/redo. Each entry knows how to go both ways; the
// store's applyOp executes them without re-recording.
export type Op =
  | { kind: "patch"; taskId: string; redo: TaskPatch; undo: TaskPatch }
  | { kind: "create"; task: Task }
  | { kind: "delete"; task: Task }
  | { kind: "batch"; ops: Op[] };

export interface HistoryEntry {
  op: Op;
  label: string;
}

const MAX_ENTRIES = 100;

class HistoryStore {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  push(entry: HistoryEntry) {
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_ENTRIES) this.undoStack.shift();
    this.redoStack = [];
  }

  takeUndo(): HistoryEntry | undefined {
    const entry = this.undoStack.pop();
    if (entry) this.redoStack.push(entry);
    return entry;
  }

  takeRedo(): HistoryEntry | undefined {
    const entry = this.redoStack.pop();
    if (entry) this.undoStack.push(entry);
    return entry;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export const history = new HistoryStore();
