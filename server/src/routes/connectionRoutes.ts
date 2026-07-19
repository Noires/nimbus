import { Router } from "express";
import prisma from "../prisma-client.js";
import { publish } from "../bus.js";
import { providerFor } from "../integrations/registry.js";
import { ProviderError } from "../integrations/types.js";
import { reschedule, unschedule, syncNow } from "../integrations/syncEngine.js";

const router = Router();

function errStatus(e: unknown): number {
  return e instanceof ProviderError ? (e.status >= 400 && e.status < 500 ? e.status : 502) : 500;
}

// GET /api/connections?canvasId=
router.get("/", async (req, res) => {
  try {
    const canvasId = req.query.canvasId as string | undefined;
    const connections = await prisma.connection.findMany({
      where: canvasId ? { canvasId } : {},
      orderBy: { createdAt: "asc" },
    });
    res.json(connections);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/connections { provider, canvasId, config, pollMinutes? }
router.post("/", async (req, res) => {
  try {
    const { provider: kind, canvasId, config, pollMinutes } = req.body ?? {};
    if (!kind || !canvasId || !config?.owner || !config?.repo) {
      return res.status(400).json({ error: "provider, canvasId, config.owner and config.repo are required" });
    }
    const provider = providerFor(kind);
    // Validate against the live provider; resolves project/status-field ids.
    const probe = { provider: kind, canvasId, config, columnsCache: [] } as never;
    const { configPatch, columns } = await provider.validate(probe);

    const connection = await prisma.connection.create({
      data: {
        provider: kind,
        canvasId,
        config: { ...config, ...configPatch },
        pollMinutes: Number.isInteger(pollMinutes) && pollMinutes >= 1 ? pollMinutes : 5,
        columnsCache: columns as never,
      },
    });
    publish(canvasId, { entity: "connection", action: "upsert", data: connection, clientId: req.header("x-client-id") });
    await reschedule(connection.id); // fires a near-immediate first sync
    return res.status(201).json(connection);
  } catch (e) {
    return res.status(errStatus(e)).json({ error: (e as Error).message });
  }
});

// PATCH /api/connections/:id { config?, pollMinutes?, enabled? }
router.patch("/:id", async (req, res) => {
  try {
    const existing = await prisma.connection.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Connection not found" });

    const data: Record<string, unknown> = {};
    const { config, pollMinutes, enabled } = req.body ?? {};
    if (config && typeof config === "object") {
      const provider = providerFor(existing.provider);
      const merged = { ...(existing.config as object), ...config };
      const probe = { ...existing, config: merged } as never;
      const { configPatch, columns } = await provider.validate(probe);
      data.config = { ...merged, ...configPatch };
      data.columnsCache = columns;
    }
    if (Number.isInteger(pollMinutes) && pollMinutes >= 1) data.pollMinutes = pollMinutes;
    if (typeof enabled === "boolean") data.enabled = enabled;

    const connection = await prisma.connection.update({ where: { id: req.params.id }, data });
    publish(connection.canvasId, { entity: "connection", action: "upsert", data: connection, clientId: req.header("x-client-id") });
    if (connection.enabled) await reschedule(connection.id);
    else unschedule(connection.id);
    return res.json(connection);
  } catch (e) {
    return res.status(errStatus(e)).json({ error: (e as Error).message });
  }
});

// DELETE /api/connections/:id — tasks keep externalKey (SetNull) so a
// re-added connection re-links them.
router.delete("/:id", async (req, res) => {
  try {
    unschedule(req.params.id);
    const connection = await prisma.connection.delete({ where: { id: req.params.id } });
    publish(connection.canvasId, { entity: "connection", action: "delete", data: { id: connection.id }, clientId: req.header("x-client-id") });
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/connections/:id/sync — awaited so the UI can toast the summary.
router.post("/:id/sync", async (req, res) => {
  try {
    const summary = await syncNow(req.params.id);
    return res.json(summary);
  } catch (e) {
    return res.status(errStatus(e)).json({ error: (e as Error).message });
  }
});

// GET /api/connections/:id/columns?refresh=true
router.get("/:id/columns", async (req, res) => {
  try {
    const connection = await prisma.connection.findUnique({ where: { id: req.params.id } });
    if (!connection) return res.status(404).json({ error: "Connection not found" });
    if (req.query.refresh === "true") {
      const columns = await providerFor(connection.provider).getColumns(connection);
      const saved = await prisma.connection.update({
        where: { id: connection.id },
        data: { columnsCache: columns as never },
      });
      publish(saved.canvasId, { entity: "connection", action: "upsert", data: saved });
      return res.json(columns);
    }
    return res.json(connection.columnsCache);
  } catch (e) {
    return res.status(errStatus(e)).json({ error: (e as Error).message });
  }
});

export default router;
