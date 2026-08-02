import type { Task, Workstream } from "./api";

export interface OperationsWorkstream {
  id: string;
  name: string;
  tasks: Task[];
}

function compareCanonicalWorkstreams(left: Workstream, right: Workstream): number {
  if (left.name !== right.name) return left.name < right.name ? -1 : 1;
  if (left.id !== right.id) return left.id < right.id ? -1 : 1;
  return 0;
}

function compareTasks(left: Task, right: Task): number {
  if (left.title !== right.title) return left.title < right.title ? -1 : 1;
  if (left.id !== right.id) return left.id < right.id ? -1 : 1;
  return 0;
}

/**
 * Pure, local Operations projection. A task is shown once: its canonical
 * durable workstream is the lexically first matching name, then id.
 */
export function selectOperationsWorkstreams({
  tasks,
  workstreams,
}: {
  tasks: Task[];
  workstreams: Workstream[];
}): OperationsWorkstream[] {
  const activeTasks = tasks.filter((task) => !task.archivedAt && !task.done && !task.inbox).sort(compareTasks);
  const taskIds = new Set(activeTasks.map((task) => task.id));
  const canonicalWorkstreams = [...workstreams].sort(compareCanonicalWorkstreams);
  const workstreamForTask = new Map<string, Workstream>();

  for (const workstream of canonicalWorkstreams) {
    for (const membership of workstream.memberships) {
      if (taskIds.has(membership.taskId) && !workstreamForTask.has(membership.taskId)) {
        workstreamForTask.set(membership.taskId, workstream);
      }
    }
  }

  const tasksByWorkstream = new Map<string, Task[]>();
  const unassigned: Task[] = [];
  for (const task of activeTasks) {
    const workstream = workstreamForTask.get(task.id);
    if (!workstream) {
      unassigned.push(task);
      continue;
    }
    const assigned = tasksByWorkstream.get(workstream.id) ?? [];
    assigned.push(task);
    tasksByWorkstream.set(workstream.id, assigned);
  }

  const groups = canonicalWorkstreams.flatMap((workstream) => {
    const assigned = tasksByWorkstream.get(workstream.id);
    return assigned?.length ? [{ id: workstream.id, name: workstream.name, tasks: assigned }] : [];
  });

  return unassigned.length ? [{ id: "unassigned", name: "Unassigned", tasks: unassigned }, ...groups] : groups;
}
