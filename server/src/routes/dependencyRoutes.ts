import { Router } from "express";
import prisma from "../prisma-client.js";
import { publish } from "../bus.js";

const router = Router();

// GET /api/dependencies?canvasId=
router.get("/", async (req, res) => {
  try {
    const canvasId = req.query.canvasId as string | undefined;
    const deps = await prisma.dependency.findMany({
      where: canvasId ? { blocker: { canvasId } } : {},
    });
    res.json(deps);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/dependencies { blockerId, blockedId } — with cycle prevention
router.post("/", async (req, res) => {
  try {
    const { blockerId, blockedId } = req.body ?? {};
    if (!blockerId || !blockedId) return res.status(400).json({ error: "Missing blockerId/blockedId" });
    if (blockerId === blockedId) return res.status(400).json({ error: "A task cannot block itself" });

    const [blocker, blocked] = await Promise.all([
      prisma.task.findUnique({ where: { id: blockerId } }),
      prisma.task.findUnique({ where: { id: blockedId } }),
    ]);
    if (!blocker || !blocked) return res.status(404).json({ error: "Task not found" });
    if (blocker.canvasId !== blocked.canvasId)
      return res.status(400).json({ error: "Tasks are on different canvases" });

    // Cycle check: would blockerId become reachable from blockedId?
    const deps = await prisma.dependency.findMany({ where: { blocker: { canvasId: blocker.canvasId } } });
    const edges = new Map<string, string[]>();
    for (const d of deps) {
      const list = edges.get(d.blockerId);
      if (list) list.push(d.blockedId);
      else edges.set(d.blockerId, [d.blockedId]);
    }
    const stack = [blockedId as string];
    const seen = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === blockerId) return res.status(400).json({ error: "Would create a dependency cycle" });
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const next of edges.get(cur) ?? []) stack.push(next);
    }

    const dep = await prisma.dependency.create({ data: { blockerId, blockedId } });
    publish(blocker.canvasId, { entity: "dependency", action: "upsert", data: dep, clientId: req.header("x-client-id") });
    return res.status(201).json(dep);
  } catch (e) {
    // Unique constraint → the thread already exists
    if ((e as { code?: string }).code === "P2002")
      return res.status(409).json({ error: "Dependency already exists" });
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /api/dependencies/:id
router.delete("/:id", async (req, res) => {
  try {
    const dep = await prisma.dependency.delete({ where: { id: req.params.id } });
    const blocker = await prisma.task.findUnique({ where: { id: dep.blockerId }, select: { canvasId: true } });
    if (blocker) publish(blocker.canvasId, { entity: "dependency", action: "delete", data: { id: dep.id }, clientId: req.header("x-client-id") });
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
