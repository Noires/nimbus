import type { Workstream } from "./api";

/** Explicit memberships only; proximity clusters never participate here. */
export function workstreamTaskCount(workstream: Workstream): number {
  return workstream.memberships.length;
}

export function workstreamsForTask(workstreams: Workstream[], taskId: string): Workstream[] {
  return workstreams.filter((workstream) =>
    workstream.memberships.some((membership) => membership.taskId === taskId),
  );
}
