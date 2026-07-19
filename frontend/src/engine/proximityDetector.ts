import { useEffect, useState } from "react";
import { useStore, visibleTasks, type Task } from "../store";

export const THRESHOLD = 240; // px, center-to-center (plan §7)
export const HYSTERESIS = THRESHOLD * 1.15; // 276px un-cluster distance from centroid

export interface Cluster {
  id: string; // stable-ish: smallest member task id
  members: string[]; // sorted task ids
}

interface Point {
  x: number;
  y: number;
}

function centerOf(task: Task): Point {
  // Card is w-64 (256px) and roughly 160px tall; cluster on the visual center.
  return { x: task.x + 128, y: task.y + 80 };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function find(parent: number[], i: number): number {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]]; // path halving
    i = parent[i];
  }
  return i;
}

function union(parent: number[], rank: number[], a: number, b: number) {
  const ra = find(parent, a);
  const rb = find(parent, b);
  if (ra === rb) return;
  if (rank[ra] < rank[rb]) parent[ra] = rb;
  else if (rank[ra] > rank[rb]) parent[rb] = ra;
  else {
    parent[rb] = ra;
    rank[ra]++;
  }
}

export function computeClusters(tasks: Task[], prev: Cluster[]): Cluster[] {
  const n = tasks.length;
  if (n < 2) return [];

  const centers = tasks.map(centerOf);
  const parent = tasks.map((_, i) => i);
  const rank = new Array<number>(n).fill(0);

  // 1-2. Adjacency edges within THRESHOLD, merged via union-find.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dist(centers[i], centers[j]) <= THRESHOLD) union(parent, rank, i, j);
    }
  }

  // Hysteresis: a card that was in a cluster last frame stays attached while it
  // remains within HYSTERESIS of that cluster's current centroid.
  const indexById = new Map(tasks.map((t, i) => [t.id, i]));
  for (const cluster of prev) {
    const present = cluster.members
      .map((id) => indexById.get(id))
      .filter((i): i is number => i !== undefined);
    if (present.length < 2) continue;

    const centroid: Point = {
      x: present.reduce((s, i) => s + centers[i].x, 0) / present.length,
      y: present.reduce((s, i) => s + centers[i].y, 0) / present.length,
    };
    for (const i of present) {
      if (dist(centers[i], centroid) <= HYSTERESIS) {
        // Re-attach to any other former member still inside the hysteresis band.
        for (const j of present) {
          if (j !== i && dist(centers[j], centroid) <= HYSTERESIS) union(parent, rank, i, j);
        }
      }
    }
  }

  // 3. Extract connected components with 2+ members.
  const groups = new Map<number, string[]>();
  for (let i = 0; i < n; i++) {
    const root = find(parent, i);
    const g = groups.get(root);
    if (g) g.push(tasks[i].id);
    else groups.set(root, [tasks[i].id]);
  }

  const clusters: Cluster[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort();
    clusters.push({ id: members[0], members });
  }
  clusters.sort((a, b) => a.id.localeCompare(b.id));
  return clusters;
}

function sameClusters(a: Cluster[], b: Cluster[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].members.length !== b[i].members.length) return false;
    for (let j = 0; j < a[i].members.length; j++) {
      if (a[i].members[j] !== b[i].members[j]) return false;
    }
  }
  return true;
}

const FRAME_MS = 33; // ~30fps cap (plan §7)

/** rAF-driven cluster detection. Re-renders only when memberships change;
 *  bubble geometry is derived from live task positions at render time. */
export function useClusters(): Cluster[] {
  const [clusters, setClusters] = useState<Cluster[]>([]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let prev: Cluster[] = [];

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < FRAME_MS) return;
      last = t;

      const { tasks, showDone, showArchived, lens, replayTasks } = useStore.getState();
      // During replay, cluster the historical ghosts so bubbles form and
      // dissolve in the time-lapse. The time lens projects positions, so
      // spatial clustering is meaningless there.
      const source = replayTasks ?? visibleTasks(tasks, showDone, showArchived);
      const next = lens === "time" ? [] : computeClusters(source, prev);
      if (!sameClusters(next, prev)) setClusters(next);
      prev = next;
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return clusters;
}
