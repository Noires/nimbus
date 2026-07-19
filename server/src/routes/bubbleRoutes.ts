import { Router } from "express";
import prisma from "../prisma-client.js";
import { publish } from "../bus.js";

const router = Router();

// GET /api/bubbles?canvasId=
router.get("/", async (req, res) => {
  try {
    const canvasId = req.query.canvasId as string | undefined;
    const bubbles = await prisma.bubble.findMany({
      where: canvasId ? { canvasId } : {},
      orderBy: { createdAt: "asc" },
    });
    res.json(bubbles);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/bubbles
router.post("/", async (req, res) => {
  try {
    const { canvasId, title, hue, memberIds, pinned } = req.body ?? {};
    if (!canvasId) return res.status(400).json({ error: "Missing canvasId" });
    const bubble = await prisma.bubble.create({
      data: {
        canvasId,
        title: typeof title === "string" ? title : "",
        hue: Number.isInteger(hue) ? hue : null,
        memberIds: Array.isArray(memberIds) ? memberIds : [],
        pinned: pinned === true,
      },
    });
    publish(bubble.canvasId, { entity: "bubble", action: "upsert", data: bubble, clientId: req.header("x-client-id") });
    return res.status(201).json(bubble);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// PATCH /api/bubbles/:id
router.patch("/:id", async (req, res) => {
  try {
    const data: Record<string, unknown> = {};
    const { title, hue, memberIds, pinned } = req.body ?? {};
    if (typeof title === "string") data.title = title;
    if (Number.isInteger(hue) || hue === null) data.hue = hue;
    if (Array.isArray(memberIds)) data.memberIds = memberIds;
    if (typeof pinned === "boolean") data.pinned = pinned;
    const bubble = await prisma.bubble.update({ where: { id: req.params.id }, data });
    publish(bubble.canvasId, { entity: "bubble", action: "upsert", data: bubble, clientId: req.header("x-client-id") });
    return res.json(bubble);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /api/bubbles/:id
router.delete("/:id", async (req, res) => {
  try {
    const bubble = await prisma.bubble.delete({ where: { id: req.params.id } });
    publish(bubble.canvasId, { entity: "bubble", action: "delete", data: { id: bubble.id }, clientId: req.header("x-client-id") });
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
