import type { Task } from "./api";

interface TaskRetrievalInput {
  tasks: Task[];
  query: string;
  limit?: number;
}

interface TaskMatch {
  task: Task;
  rank: number;
  normalizedTitle: string;
}

export function normalizeTaskRetrievalText(value: string): string {
  return value.normalize().trim().toLowerCase();
}

/** Selects deterministic, local-only task title matches for Command Center retrieval. */
export function selectTaskRetrievalResults({
  tasks,
  query,
  limit = 8,
}: TaskRetrievalInput): Task[] {
  const normalizedQuery = normalizeTaskRetrievalText(query);
  if (!normalizedQuery) return [];

  return tasks
    .filter((task) => !task.archivedAt)
    .map((task): TaskMatch | null => {
      const normalizedTitle = normalizeTaskRetrievalText(task.title);
      if (!normalizedTitle.includes(normalizedQuery)) return null;

      return {
        task,
        normalizedTitle,
        rank: normalizedTitle === normalizedQuery ? 0 : normalizedTitle.startsWith(normalizedQuery) ? 1 : 2,
      };
    })
    .filter((match): match is TaskMatch => match !== null)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.normalizedTitle < b.normalizedTitle) return -1;
      if (a.normalizedTitle > b.normalizedTitle) return 1;
      if (a.task.id < b.task.id) return -1;
      if (a.task.id > b.task.id) return 1;
      return 0;
    })
    .slice(0, Math.max(0, limit))
    .map((match) => match.task);
}
