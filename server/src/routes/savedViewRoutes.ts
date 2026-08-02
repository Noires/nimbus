import { Router } from "express";
import prisma from "../prisma-client.js";

const router = Router();
const sortFields = new Set(["title", "priority", "dueDate", "createdAt"]);
const groups = new Set(["none", "tag", "status", "priority", "dueDate"]);
type ViewConfig = { done?: boolean; tag?: string; priority?: string; group?: string; sort?: string; direction?: string };

function validConfig(value: unknown): value is ViewConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  return (!("done" in config) || typeof config.done === "boolean")
    && (!("tag" in config) || typeof config.tag === "string")
    && (!("priority" in config) || typeof config.priority === "string")
    && (!("group" in config) || typeof config.group === "string" && groups.has(config.group))
    && (!("sort" in config) || typeof config.sort === "string" && sortFields.has(config.sort))
    && (!("direction" in config) || config.direction === "asc" || config.direction === "desc");
}

router.get("/", async (req, res) => {
  const canvasId = req.query.canvasId;
  if (typeof canvasId !== "string" || !canvasId) return res.status(400).json({ error: "canvasId is required" });
  try { return res.json(await prisma.savedView.findMany({ where: { canvasId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })); }
  catch (error) { return res.status(500).json({ error: (error as Error).message }); }
});
router.post("/", async (req, res) => {
  const { canvasId, name, config } = req.body ?? {};
  if (typeof canvasId !== "string" || typeof name !== "string" || !name.trim() || !validConfig(config)) return res.status(400).json({ error: "A canvasId, name, and valid explicit config are required" });
  try { return res.status(201).json(await prisma.savedView.create({ data: { canvasId, name: name.trim().slice(0, 120), config } })); }
  catch (error) { return res.status(500).json({ error: (error as Error).message }); }
});
router.patch("/:id", async (req, res) => {
  const { name, config } = req.body ?? {};
  if ((name !== undefined && (typeof name !== "string" || !name.trim())) || (config !== undefined && !validConfig(config))) return res.status(400).json({ error: "Invalid saved view update" });
  try { return res.json(await prisma.savedView.update({ where: { id: req.params.id }, data: { ...(name === undefined ? {} : { name: name.trim().slice(0, 120) }), ...(config === undefined ? {} : { config }) } })); }
  catch (error) { return res.status(404).json({ error: (error as Error).message }); }
});
router.delete("/:id", async (req, res) => {
  try { await prisma.savedView.delete({ where: { id: req.params.id } }); return res.status(204).send(); }
  catch (error) { return res.status(404).json({ error: (error as Error).message }); }
});
export default router;
