import { Router } from "express";
import prisma from "../prisma-client.js";
import { publish } from "../bus.js";
import { BlockerLinkError, replaceTaskBlocker } from "./taskRoutes.js";

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
    if (typeof blockerId !== "string" || typeof blockedId !== "string" || !blockerId || !blockedId)
      return res.status(400).json({ error: "Missing blockerId/blockedId" });
    const change = await replaceTaskBlocker(blockedId, blockerId, false);
    publish(change.task.canvasId, { entity: "dependency", action: "upsert", data: change.dependency!, clientId: req.header("x-client-id") });
    return res.status(201).json(change.dependency);
  } catch (e) {
    const status = e instanceof BlockerLinkError ? e.status : (e as { code?: string }).code === "P2034" ? 409 : 500;
    return res.status(status).json({ error: (e as Error).message });
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
