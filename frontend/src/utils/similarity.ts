import type { Task } from "../store";
import { quickParse } from "./quickParse";

// Token-set Dice coefficient over normalized titles.
export function titleSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/** Best existing near-duplicate for a draft title (quick-add tokens stripped),
 *  open tasks preferred. Returns null under the 0.5 threshold. */
export function findSimilar(draft: string, tasks: Task[], excludeId?: string): Task | null {
  const title = quickParse(draft).title;
  if (title.trim().length < 4) return null;
  let best: Task | null = null;
  let bestScore = 0.5;
  for (const task of tasks) {
    if (task.id === excludeId || task.inbox) continue;
    const score = titleSimilarity(title, task.title) - (task.done || task.archivedAt ? 0.1 : 0);
    if (score > bestScore) {
      best = task;
      bestScore = score;
    }
  }
  return best;
}
