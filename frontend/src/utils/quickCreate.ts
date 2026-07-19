import { useStore, CARD_W, CARD_H, type Task } from "../store";
import { resolveOverlap } from "../engine/collision";
import { quickParse } from "./quickParse";

function fuzzyBubble(name: string) {
  const bubbles = useStore.getState().bubbles.filter((b) => b.title);
  const low = name.toLowerCase();
  return (
    bubbles.find((b) => b.title.toLowerCase() === low) ??
    bubbles.find((b) => b.title.toLowerCase().startsWith(low)) ??
    bubbles.find((b) => b.title.toLowerCase().includes(low)) ??
    null
  );
}

/** Create a task from quick-add grammar. `@Bubble` drops it at that bubble's
 *  centroid (collision-nudged) and joins the membership; otherwise it lands at
 *  the viewport center. Returns the created task, or null for empty titles. */
export async function quickCreate(canvasId: string, input: string): Promise<Task | null> {
  const store = useStore.getState();
  const parsed = quickParse(input);
  if (!parsed.title) return null;

  const bubble = parsed.bubbleName ? fuzzyBubble(parsed.bubbleName) : null;
  let x: number;
  let y: number;
  if (bubble) {
    const members = store.tasks.filter((t) => bubble.memberIds.includes(t.id));
    const cx = members.length
      ? members.reduce((s, t) => s + t.x, 0) / members.length
      : (store.viewportW / 2 - store.panX) / store.zoom - CARD_W / 2;
    const cy = members.length
      ? members.reduce((s, t) => s + t.y, 0) / members.length
      : (store.viewportH / 2 - store.panY) / store.zoom - CARD_H / 2;
    const nudged = resolveOverlap({ x: cx, y: cy }, "", store.tasks);
    x = nudged?.x ?? cx + 40;
    y = nudged?.y ?? cy + 40;
  } else {
    const jitter = () => (Math.random() - 0.5) * 80;
    x = (store.viewportW / 2 - store.panX) / store.zoom - CARD_W / 2 + jitter();
    y = (store.viewportH / 2 - store.panY) / store.zoom - CARD_H / 2 + jitter();
  }

  const task = await store.addTask({
    canvasId,
    title: parsed.title,
    tags: parsed.tags,
    priority: parsed.priority ?? undefined,
    dueDate: parsed.dueDate,
    estimateMinutes: parsed.estimateMinutes,
    x,
    y,
  });

  if (bubble) {
    await store.updateBubble(bubble.id, { memberIds: [...bubble.memberIds, task.id] });
  }
  store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, Math.max(store.zoom, 0.8));
  store.flashTask(task.id);
  return task;
}
