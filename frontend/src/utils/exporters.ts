import { computeClusters } from "../engine/proximityDetector";
import { bestBubbleMatch, visibleTasks, type Bubble, type Task } from "../store";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function taskLine(t: Task): string {
  const parts = [`- [${t.done ? "x" : " "}] ${t.title}`];
  if (t.dueDate) parts.push(`(due ${new Date(t.dueDate).toLocaleDateString()})`);
  if (t.tags.length) parts.push(`#${t.tags.join(" #")}`);
  if (t.priority === "high") parts.push("‼");
  return parts.join(" ");
}

// The spatial arrangement becomes a document: bubbles → headings, stack
// order (top to bottom) → list order.
export function exportMarkdown(canvasName: string, tasks: Task[], bubbles: Bubble[]) {
  const shown = visibleTasks(tasks, true, false);
  const clusters = computeClusters(shown, []);
  const byId = new Map(shown.map((t) => [t.id, t]));
  const clustered = new Set<string>();

  const lines: string[] = [`# ${canvasName}`, ""];
  for (const cluster of clusters) {
    const members = cluster.members
      .map((id) => byId.get(id))
      .filter((t): t is Task => !!t)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    members.forEach((m) => clustered.add(m.id));
    const title = bestBubbleMatch(bubbles, cluster.members)?.title || "Untitled bubble";
    lines.push(`## ${title}`, "");
    for (const m of members) lines.push(taskLine(m));
    lines.push("");
  }

  const loose = shown.filter((t) => !clustered.has(t.id)).sort((a, b) => a.y - b.y || a.x - b.x);
  if (loose.length) {
    lines.push("## Loose", "");
    for (const t of loose) lines.push(taskLine(t));
    lines.push("");
  }

  download(`${canvasName}.md`, lines.join("\n"), "text/markdown");
}

export function exportCsv(canvasName: string, tasks: Task[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["id", "title", "description", "tags", "priority", "dueDate", "done", "estimateMinutes", "x", "y"];
  const rows = tasks.map((t) =>
    [t.id, t.title, t.description, t.tags.join(";"), t.priority, t.dueDate ?? "", t.done, t.estimateMinutes ?? "", t.x, t.y]
      .map(esc)
      .join(","),
  );
  download(`${canvasName}.csv`, [header.join(","), ...rows].join("\n"), "text/csv");
}

export function exportJson(canvasName: string, payload: unknown) {
  download(`${canvasName}.json`, JSON.stringify(payload, null, 2), "application/json");
}

export function pickJsonFile(): Promise<unknown | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file
        .text()
        .then((text) => resolve(JSON.parse(text)))
        .catch(() => resolve(null));
    };
    input.click();
  });
}
