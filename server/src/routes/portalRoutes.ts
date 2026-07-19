import { Router } from "express";
import prisma from "../prisma-client.js";
import { publish } from "../bus.js";

const router = Router();

// GET /api/portals?canvasId=
router.get("/", async (req, res) => {
  try {
    const canvasId = req.query.canvasId as string | undefined;
    const portals = await prisma.portal.findMany({
      where: canvasId ? { canvasId } : {},
      include: { target: { select: { name: true } } },
    });
    res.json(portals);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/portals { canvasId, targetCanvasId, x, y }
router.post("/", async (req, res) => {
  try {
    const { canvasId, targetCanvasId, x, y } = req.body ?? {};
    if (!canvasId || !targetCanvasId) return res.status(400).json({ error: "Missing canvas ids" });
    if (canvasId === targetCanvasId)
      return res.status(400).json({ error: "A portal cannot target its own canvas" });
    const portal = await prisma.portal.create({
      data: {
        canvasId,
        targetCanvasId,
        x: typeof x === "number" ? x : 100,
        y: typeof y === "number" ? y : 100,
      },
      include: { target: { select: { name: true } } },
    });
    publish(portal.canvasId, { entity: "portal", action: "upsert", data: portal, clientId: req.header("x-client-id") });
    return res.status(201).json(portal);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PATCH /api/portals/:id { x, y }
router.patch("/:id", async (req, res) => {
  try {
    const data: Record<string, unknown> = {};
    if (typeof req.body?.x === "number") data.x = req.body.x;
    if (typeof req.body?.y === "number") data.y = req.body.y;
    const portal = await prisma.portal.update({
      where: { id: req.params.id },
      data,
      include: { target: { select: { name: true } } },
    });
    publish(portal.canvasId, { entity: "portal", action: "upsert", data: portal, clientId: req.header("x-client-id") });
    return res.json(portal);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /api/portals/:id
router.delete("/:id", async (req, res) => {
  try {
    const portal = await prisma.portal.delete({ where: { id: req.params.id } });
    publish(portal.canvasId, { entity: "portal", action: "delete", data: { id: portal.id }, clientId: req.header("x-client-id") });
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
