// Quick-add grammar: "friday 2h #api !high @Launch fix login" →
// dueDate/estimate/tags/priority/bubble + remaining title.
// Dependency-free ON PURPOSE: server/src/quickParse.ts is a verbatim copy
// (workspaces can't share source across tsconfig rootDirs) — keep both in sync.

export interface ParsedQuickAdd {
  title: string;
  dueDate: string | null; // ISO
  estimateMinutes: number | null;
  tags: string[];
  priority: string | null;
  bubbleName: string | null; // raw @token — caller resolves against bubbles
}

export interface ParsedToken {
  text: string;
  kind: "title" | "date" | "duration" | "tag" | "priority" | "bubble";
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function nextWeekday(from: Date, target: number): Date {
  const d = startOfDay(from);
  const diff = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d;
}

export function quickParse(input: string, now = new Date()): ParsedQuickAdd {
  const { fields } = quickParseTokens(input, now);
  return fields;
}

/** Same parse, but also returns per-token classification for chip rendering. */
export function quickParseTokens(
  input: string,
  now = new Date(),
): { fields: ParsedQuickAdd; tokens: ParsedToken[] } {
  const raw = input.trim().length ? input.trim().split(/\s+/) : [];
  const rest: string[] = [];
  const tokens: ParsedToken[] = [];
  let dueDate: Date | null = null;
  let estimateMinutes: number | null = null;
  let priority: string | null = null;
  let bubbleName: string | null = null;
  const tags: string[] = [];

  for (const tok of raw) {
    const low = tok.toLowerCase();
    let kind: ParsedToken["kind"] = "title";

    if (low.startsWith("#") && tok.length > 1) {
      tags.push(tok.slice(1));
      kind = "tag";
    } else if (low.startsWith("@") && tok.length > 1) {
      bubbleName = tok.slice(1);
      kind = "bubble";
    } else if (["!high", "!h"].includes(low)) {
      priority = "high";
      kind = "priority";
    } else if (["!low", "!l"].includes(low)) {
      priority = "low";
      kind = "priority";
    } else if (["!medium", "!med", "!m"].includes(low)) {
      priority = "medium";
      kind = "priority";
    } else if (/^(\d+(?:\.\d+)?)h$/.test(low)) {
      estimateMinutes = Math.round(parseFloat(low) * 60);
      kind = "duration";
    } else if (/^(\d+)m$/.test(low)) {
      estimateMinutes = parseInt(low, 10);
      kind = "duration";
    } else if (/^\+(\d+)([dw])$/.test(low)) {
      const m = low.match(/^\+(\d+)([dw])$/)!;
      const d = startOfDay(now);
      d.setDate(d.getDate() + parseInt(m[1], 10) * (m[2] === "w" ? 7 : 1));
      dueDate = d;
      kind = "date";
    } else if (low === "today") {
      dueDate = startOfDay(now);
      kind = "date";
    } else if (low === "tomorrow" || low === "tmrw") {
      const d = startOfDay(now);
      d.setDate(d.getDate() + 1);
      dueDate = d;
      kind = "date";
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(low)) {
      dueDate = new Date(`${low}T00:00:00`);
      kind = "date";
    } else {
      const wd = WEEKDAYS.findIndex((w) => w === low || (low.length === 3 && w.startsWith(low)));
      if (wd >= 0) {
        dueDate = nextWeekday(now, wd);
        kind = "date";
      } else {
        rest.push(tok);
      }
    }
    tokens.push({ text: tok, kind });
  }

  return {
    fields: {
      title: rest.join(" "),
      dueDate: dueDate ? dueDate.toISOString() : null,
      estimateMinutes,
      tags,
      priority,
      bubbleName,
    },
    tokens,
  };
}
