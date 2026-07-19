import { Router } from "express";
import prisma from "../prisma-client.js";
import { publish } from "../bus.js";

const router = Router();

// GET /api/zones?canvasId=
router.get("/", async (req, res) => {
  try {
    const canvasId = req.query.canvasId as string | undefined;
    const zones = await prisma.zone.findMany({
      where: canvasId ? { canvasId } : {},
      orderBy: { z: "asc" },
    });
    res.json(zones);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/zones
router.post("/", async (req, res) => {
  try {
    const { canvasId, x, y, w, h, label, hue, autoTag } = req.body ?? {};
    if (!canvasId) return res.status(400).json({ error: "Missing canvasId" });
    const zone = await prisma.zone.create({
      data: {
        canvasId,
        x: Number(x) || 0,
        y: Number(y) || 0,
        w: Math.max(Number(w) || 400, 120),
        h: Math.max(Number(h) || 300, 120),
        label: typeof label === "string" ? label : "",
        hue: Number.isInteger(hue) ? hue : 200,
        autoTag: typeof autoTag === "string" && autoTag ? autoTag : null,
      },
    });
    publish(zone.canvasId, { entity: "zone", action: "upsert", data: zone, clientId: req.header("x-client-id") });
    return res.status(201).json(zone);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PATCH /api/zones/:id
router.patch("/:id", async (req, res) => {
  try {
    const data: Record<string, unknown> = {};
    const { x, y, w, h, label, hue, autoTag } = req.body ?? {};
    if (typeof x === "number") data.x = x;
    if (typeof y === "number") data.y = y;
    if (typeof w === "number") data.w = Math.max(w, 120);
    if (typeof h === "number") data.h = Math.max(h, 120);
    if (typeof label === "string") data.label = label;
    if (Number.isInteger(hue)) data.hue = hue;
    if (autoTag === null || typeof autoTag === "string") data.autoTag = autoTag || null;
    const zone = await prisma.zone.update({ where: { id: req.params.id }, data });
    publish(zone.canvasId, { entity: "zone", action: "upsert", data: zone, clientId: req.header("x-client-id") });
    return res.json(zone);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /api/zones/:id
router.delete("/:id", async (req, res) => {
  try {
    const zone = await prisma.zone.delete({ where: { id: req.params.id } });
    publish(zone.canvasId, { entity: "zone", action: "delete", data: { id: zone.id }, clientId: req.header("x-client-id") });
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
