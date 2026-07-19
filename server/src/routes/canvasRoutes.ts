import { randomBytes } from 'crypto';
import { Router } from 'express';
import prisma from '../prisma-client.js';
import { subscribe } from '../bus.js';

const router = Router();

const TOKEN_FIELDS = { share: 'shareToken', ics: 'icsToken', capture: 'captureToken' } as const;

// SSE live-sync stream for a canvas
router.get('/:id/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write(': connected\n\n');
  const unsubscribe = subscribe(req.params.id, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': hb\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// Mint/rotate or revoke a token (kind: share | ics | capture)
router.post('/:id/token/:kind', async (req, res) => {
  try {
    const field = TOKEN_FIELDS[req.params.kind as keyof typeof TOKEN_FIELDS];
    if (!field) return res.status(400).json({ error: 'Unknown token kind' });
    const canvas = await prisma.canvas.update({
      where: { id: req.params.id },
      data: { [field]: randomBytes(18).toString('base64url') },
    });
    return res.json(canvas);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/:id/token/:kind', async (req, res) => {
  try {
    const field = TOKEN_FIELDS[req.params.kind as keyof typeof TOKEN_FIELDS];
    if (!field) return res.status(400).json({ error: 'Unknown token kind' });
    const canvas = await prisma.canvas.update({
      where: { id: req.params.id },
      data: { [field]: null },
    });
    return res.json(canvas);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Pulse: daily event aggregates for burndown/velocity/churn
router.get('/:id/pulse', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 120);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days + 1);

    const [events, openNow] = await Promise.all([
      prisma.taskEvent.findMany({
        where: { canvasId: req.params.id, createdAt: { gte: since } },
        select: { type: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.task.count({
        where: { canvasId: req.params.id, done: false, archivedAt: null, inbox: false },
      }),
    ]);

    // Local-date keys — toISOString() would shift local midnights into the
    // previous UTC day and misalign every bucket.
    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const series = new Map<string, Record<string, number>>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      series.set(dayKey(d), { created: 0, completed: 0, moved: 0, updated: 0, deleted: 0 });
    }
    for (const e of events) {
      const day = series.get(dayKey(e.createdAt));
      if (day && e.type in day) day[e.type]++;
    }

    res.json({
      openNow,
      days: [...series.entries()].map(([date, counts]) => ({ date, ...counts })),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// List all canvases
router.get('/', async (_req, res) => {
  try {
    const canvases = await prisma.canvas.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(canvases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch canvases' });
  }
});

// Create a new canvas
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const canvas = await prisma.canvas.create({
      data: { name },
    });
    res.json(canvas);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create canvas' });
  }
});

// Import a canvas (full-fidelity JSON from /:id/export). Defined before /:id
// so "import" is never parsed as a canvas id.
router.post('/import', async (req, res) => {
  try {
    const { name, tasks, bubbles, dependencies } = req.body ?? {};
    if (!name || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Expected { name, tasks[] }' });
    }

    const canvas = await prisma.canvas.create({ data: { name } });
    const idMap = new Map<string, string>();

    for (const t of tasks) {
      const created = await prisma.task.create({
        data: {
          canvasId: canvas.id,
          title: String(t.title ?? 'Untitled'),
          description: String(t.description ?? ''),
          tags: Array.isArray(t.tags) ? t.tags : [],
          color: String(t.color ?? '#6366f1'),
          priority: String(t.priority ?? 'medium'),
          done: t.done === true,
          x: Number(t.x) || 100,
          y: Number(t.y) || 100,
          z: Number(t.z) || 0,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          archivedAt: t.archivedAt ? new Date(t.archivedAt) : null,
          estimateMinutes: Number.isInteger(t.estimateMinutes) ? t.estimateMinutes : null,
          recurrence: typeof t.recurrence === 'string' ? t.recurrence : null,
          inbox: t.inbox === true,
          checklist: Array.isArray(t.checklist)
            ? {
                create: t.checklist.map(
                  (c: { text?: string; done?: boolean; order?: number }, i: number) => ({
                    text: String(c.text ?? ''),
                    done: c.done === true,
                    order: Number.isInteger(c.order) ? c.order : i,
                  }),
                ),
              }
            : undefined,
        },
      });
      if (t.id) idMap.set(String(t.id), created.id);
    }

    if (Array.isArray(bubbles)) {
      for (const b of bubbles) {
        await prisma.bubble.create({
          data: {
            canvasId: canvas.id,
            title: String(b.title ?? ''),
            hue: Number.isInteger(b.hue) ? b.hue : null,
            pinned: b.pinned === true,
            memberIds: (Array.isArray(b.memberIds) ? b.memberIds : [])
              .map((id: string) => idMap.get(id))
              .filter(Boolean) as string[],
          },
        });
      }
    }

    if (Array.isArray(dependencies)) {
      for (const d of dependencies) {
        const blockerId = idMap.get(String(d.blockerId));
        const blockedId = idMap.get(String(d.blockedId));
        if (blockerId && blockedId) {
          await prisma.dependency.create({ data: { blockerId, blockedId } }).catch(() => {});
        }
      }
    }

    res.status(201).json(canvas);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Event history for a canvas (timelapse + stats)
router.get('/:id/events', async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since as string) : undefined;
    const events = await prisma.taskEvent.findMany({
      where: { canvasId: req.params.id, ...(since ? { createdAt: { gte: since } } : {}) },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Full-fidelity export
router.get('/:id/export', async (req, res) => {
  try {
    const canvas = await prisma.canvas.findUnique({
      where: { id: req.params.id },
      include: {
        tasks: { include: { checklist: { orderBy: { order: 'asc' } } } },
        bubbles: true,
      },
    });
    if (!canvas) return res.status(404).json({ error: 'Canvas not found' });
    const dependencies = await prisma.dependency.findMany({
      where: { blocker: { canvasId: canvas.id } },
    });
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      name: canvas.name,
      tasks: canvas.tasks,
      bubbles: canvas.bubbles,
      dependencies,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get a single canvas with tasks
router.get('/:id', async (req, res) => {
  try {
    const canvas = await prisma.canvas.findUnique({
      where: { id: req.params.id },
      include: {
        tasks: {
          orderBy: [{ done: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!canvas) {
      return res.status(404).json({ error: 'Canvas not found' });
    }

    res.json(canvas);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch canvas' });
  }
});

// Update a canvas (name, waypoints, autopilot settings)
router.put('/:id', async (req, res) => {
  try {
    const { name, viewpoints, settings } = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (typeof name === 'string' && name) data.name = name;
    if (Array.isArray(viewpoints)) data.viewpoints = viewpoints;
    if (settings && typeof settings === 'object') data.settings = settings;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const canvas = await prisma.canvas.update({
      where: { id: req.params.id },
      data,
    });
    res.json(canvas);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update canvas' });
  }
});

// Delete a canvas
router.delete('/:id', async (req, res) => {
  try {
    await prisma.canvas.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete canvas' });
  }
});

export default router;
