import { Router } from "express";
import prisma from "../prisma-client.js";
import { recordEvents } from "../events.js";

const router = Router();

// Template payload: { title?: string, items: [{ dx, dy, title, description?,
// tags?, color?, priority?, estimateMinutes?, dueInDays? }] }

// GET /api/templates
router.get("/", async (_req, res) => {
  try {
    const templates = await prisma.template.findMany({ orderBy: { createdAt: "desc" } });
    res.json(templates);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/templates { name, kind, payload }
router.post("/", async (req, res) => {
  try {
    const { name, kind, payload } = req.body ?? {};
    if (!name || !payload?.items?.length)
      return res.status(400).json({ error: "Missing name or payload.items" });
    const template = await prisma.template.create({
      data: { name, kind: kind === "canvas" ? "canvas" : "bubble", payload },
    });
    return res.status(201).json(template);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /api/templates/:id
router.delete("/:id", async (req, res) => {
  try {
    await prisma.template.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/templates/:id/instantiate { canvasId, x, y } — stamp the
// constellation onto a canvas, preserving relative positions.
router.post("/:id/instantiate", async (req, res) => {
  try {
    const { canvasId, x, y } = req.body ?? {};
    if (!canvasId) return res.status(400).json({ error: "Missing canvasId" });
    const template = await prisma.template.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: "Template not found" });

    const payload = template.payload as {
      title?: string;
      items: Array<{
        dx: number; dy: number; title: string; description?: string; tags?: string[];
        color?: string; priority?: string; estimateMinutes?: number; dueInDays?: number;
      }>;
    };
    const baseX = typeof x === "number" ? x : 200;
    const baseY = typeof y === "number" ? y : 200;

    const tasks = await prisma.$transaction(
      payload.items.map((item) =>
        prisma.task.create({
          data: {
            canvasId,
            title: item.title,
            description: item.description ?? "",
            tags: item.tags ?? [],
            color: item.color || "#6366f1",
            priority: item.priority ?? "medium",
            estimateMinutes: item.estimateMinutes ?? null,
            dueDate:
              item.dueInDays !== undefined
                ? new Date(Date.now() + item.dueInDays * 86_400_000)
                : null,
            x: baseX + item.dx,
            y: baseY + item.dy,
          },
          include: { checklist: true },
        }),
      ),
    );

    void recordEvents(
      tasks.map((t) => ({
        taskId: t.id,
        canvasId,
        type: "created" as const,
        payload: { title: t.title, x: t.x, y: t.y, template: template.name },
      })),
    );

    return res.status(201).json({ tasks, title: payload.title ?? template.name });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
