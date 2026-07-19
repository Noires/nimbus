import { Router } from "express";
import prisma from "../prisma-client.js";
import { recordEvent } from "../events.js";
import { publish } from "../bus.js";
import { quickParse } from "../quickParse.js";

// Token-authenticated public endpoints: read-only share snapshots, ICS
// calendar feeds, and the capture hook. No session auth by design — the
// token IS the credential; each is independently mintable/rotatable.
const router = Router();

// GET /api/share/:token — full read-only board snapshot
router.get("/share/:token", async (req, res) => {
  try {
    const canvas = await prisma.canvas.findUnique({
      where: { shareToken: req.params.token },
      include: {
        tasks: { include: { checklist: { orderBy: { order: "asc" } } } },
        bubbles: true,
        zones: true,
      },
    });
    if (!canvas) return res.status(404).json({ error: "Unknown or revoked link" });
    const dependencies = await prisma.dependency.findMany({
      where: { blocker: { canvasId: canvas.id } },
    });
    return res.json({
      canvas: { id: canvas.id, name: canvas.name },
      tasks: canvas.tasks,
      bubbles: canvas.bubbles,
      zones: canvas.zones,
      dependencies,
    });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/feeds/:token(.ics) — subscribeable calendar of dated tasks.
// Express 5 params consume the ".ics" suffix, so strip it in the handler.
router.get("/feeds/:token", async (req, res) => {
  try {
    const canvas = await prisma.canvas.findUnique({
      where: { icsToken: req.params.token.replace(/\.ics$/i, "") },
      include: { tasks: { where: { done: false, archivedAt: null, dueDate: { not: null } } } },
    });
    if (!canvas) return res.status(404).send("Unknown or revoked feed");

    const fmtDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
    const fmtStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//task-dashboard//EN",
      `X-WR-CALNAME:${esc(canvas.name)} (tasks)`,
    ];
    for (const task of canvas.tasks) {
      const due = task.dueDate!;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${task.id}@task-dashboard`,
        `DTSTAMP:${fmtStamp(new Date())}`,
        // All-day event on the due date; estimate noted in the description.
        `DTSTART;VALUE=DATE:${fmtDate(due)}`,
        `SUMMARY:${esc(task.title)}`,
        ...(task.priority === "high" ? ["PRIORITY:1"] : []),
        ...(task.description || task.estimateMinutes
          ? [
              `DESCRIPTION:${esc(
                [task.description, task.estimateMinutes ? `Estimate: ${task.estimateMinutes}m` : ""]
                  .filter(Boolean)
                  .join("\n"),
              )}`,
            ]
          : []),
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");

    res.set("Content-Type", "text/calendar; charset=utf-8");
    return res.send(lines.join("\r\n"));
  } catch (e) {
    return res.status(500).send((e as Error).message);
  }
});

// POST /api/capture/:token { text } — external quick capture into the inbox
router.post("/capture/:token", async (req, res) => {
  try {
    const canvas = await prisma.canvas.findUnique({ where: { captureToken: req.params.token } });
    if (!canvas) return res.status(404).json({ error: "Unknown or revoked capture URL" });
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ error: "Missing text" });

    const parsed = quickParse(text);
    if (!parsed.title) return res.status(400).json({ error: "Nothing left after parsing tokens" });

    const task = await prisma.task.create({
      data: {
        canvasId: canvas.id,
        title: parsed.title,
        tags: parsed.tags,
        description: "",
        priority: parsed.priority ?? "medium",
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        estimateMinutes: parsed.estimateMinutes,
        inbox: true,
      },
      include: { checklist: true },
    });
    void recordEvent({
      taskId: task.id,
      canvasId: canvas.id,
      type: "created",
      payload: { title: task.title, captured: true },
      actor: "capture",
    });
    publish(canvas.id, { entity: "task", action: "upsert", data: task });
    return res.status(201).json({ id: task.id, title: task.title });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
