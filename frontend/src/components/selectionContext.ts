import type { Task, Workstream } from "../store";

export type SelectionContext =
  | { kind: "directory" }
  | { kind: "task"; task: Task }
  | { kind: "workstream"; workstream: Workstream };

interface SelectionContextInput {
  selectedIds: string[];
  tasks: Task[];
  selectedWorkstreamId: string | null;
  workstreams: Workstream[];
  focusActive?: boolean;
}

/** Resolves only inspectable single-object selections; other canvas selections keep the directory visible. */
export function resolveSelectionContext({
  selectedIds,
  tasks,
  selectedWorkstreamId,
  workstreams,
  focusActive = false,
}: SelectionContextInput): SelectionContext {
  if (focusActive) return { kind: "directory" };

  if (selectedIds.length === 1) {
    const task = tasks.find((candidate) => candidate.id === selectedIds[0]);
    if (task) return { kind: "task", task };
  }

  if (selectedIds.length === 0 && selectedWorkstreamId) {
    const workstream = workstreams.find((candidate) => candidate.id === selectedWorkstreamId);
    if (workstream) return { kind: "workstream", workstream };
  }

  return { kind: "directory" };
}
