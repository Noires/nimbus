import { Router } from "express";
import prisma from "../prisma-client.js";
import { publish } from "../bus.js";

const router = Router();
const includeMemberships = { memberships: { select: { taskId: true } } } as const;

function nameFrom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= 120 ? name : null;
}

function descriptionFrom(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 2_000) return undefined;
  return value.trim() || null;
}

async function findWorkstream(id: string) {
  return prisma.workstream.findUnique({ where: { id }, include: includeMemberships });
}

// GET /api/workstreams?canvasId=
router.get("/", async (req, res) => {
  const canvasId = typeof req.query.canvasId === "string" ? req.query.canvasId : null;
  if (!canvasId) return res.status(400).json({ error: "Missing canvasId" });
  try {
    const workstreams = await prisma.workstream.findMany({
      where: { canvasId },
      include: includeMemberships,
      orderBy: [{ pinned: "desc" }, { createdAt: "asc" }],
    });
    return res.json(workstreams);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/workstreams
router.post("/", async (req, res) => {
  const { canvasId, name, description, pinned, protected: isProtected } = req.body ?? {};
  const validName = nameFrom(name);
  const parsedDescription = descriptionFrom(description);
  const validDescription = parsedDescription ?? null;
  if (typeof canvasId !== "string" || !validName || (description !== undefined && parsedDescription === undefined)) {
    return res.status(400).json({ error: "Expected canvasId, a name of 1-120 characters, and an optional description of at most 2000 characters" });
  }
  try {
    const workstream = await prisma.workstream.create({
      data: { canvasId, name: validName, description: validDescription, pinned: pinned === true, protected: isProtected === true },
      include: includeMemberships,
    });
    publish(canvasId, { entity: "workstream", action: "upsert", data: workstream, clientId: req.header("x-client-id") });
    return res.status(201).json(workstream);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// PATCH /api/workstreams/:id
router.patch("/:id", async (req, res) => {
  const { name, description, pinned, protected: isProtected } = req.body ?? {};
  const data: { name?: string; description?: string | null; pinned?: boolean; protected?: boolean } = {};
  if (name !== undefined) {
    const validName = nameFrom(name);
    if (!validName) return res.status(400).json({ error: "Name must contain 1-120 characters" });
    data.name = validName;
  }
  if (description !== undefined) {
    const validDescription = descriptionFrom(description);
    if (validDescription === undefined) return res.status(400).json({ error: "Description must be a string of at most 2000 characters" });
    data.description = validDescription;
  }
  if (typeof pinned === "boolean") data.pinned = pinned;
  if (typeof isProtected === "boolean") data.protected = isProtected;
  if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nothing to update" });
  try {
    const workstream = await prisma.workstream.update({ where: { id: req.params.id }, data, include: includeMemberships });
    publish(workstream.canvasId, { entity: "workstream", action: "upsert", data: workstream, clientId: req.header("x-client-id") });
    return res.json(workstream);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/workstreams/:id — protected workstreams must be explicitly unprotected first.
router.delete("/:id", async (req, res) => {
  try {
    const existing = await findWorkstream(req.params.id);
    if (!existing) return res.status(404).json({ error: "Workstream not found" });
    if (existing.protected) return res.status(409).json({ error: "Protected workstreams must be unprotected before deletion" });
    await prisma.workstream.delete({ where: { id: existing.id } });
    publish(existing.canvasId, { entity: "workstream", action: "delete", data: { id: existing.id }, clientId: req.header("x-client-id") });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/workstreams/:id/tasks/:taskId — explicit manual membership only.
router.put("/:id/tasks/:taskId", async (req, res) => {
  try {
    const workstream = await findWorkstream(req.params.id);
    if (!workstream) return res.status(404).json({ error: "Workstream not found" });
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId }, select: { id: true, canvasId: true } });
    if (!task || task.canvasId !== workstream.canvasId) return res.status(400).json({ error: "Task must belong to the same canvas" });
    await prisma.taskWorkstream.upsert({
      where: { taskId_workstreamId: { taskId: task.id, workstreamId: workstream.id } },
      create: { taskId: task.id, workstreamId: workstream.id },
      update: {},
    });
    const saved = await findWorkstream(workstream.id);
    publish(workstream.canvasId, { entity: "workstream", action: "upsert", data: saved, clientId: req.header("x-client-id") });
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/workstreams/:id/tasks/:taskId
router.delete("/:id/tasks/:taskId", async (req, res) => {
  try {
    const workstream = await findWorkstream(req.params.id);
    if (!workstream) return res.status(404).json({ error: "Workstream not found" });
    await prisma.taskWorkstream.deleteMany({ where: { taskId: req.params.taskId, workstreamId: workstream.id } });
    const saved = await findWorkstream(workstream.id);
    publish(workstream.canvasId, { entity: "workstream", action: "upsert", data: saved, clientId: req.header("x-client-id") });
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
