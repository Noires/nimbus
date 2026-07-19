// Load ./.env explicitly — tsx watch does not reliably forward --env-file,
// and Prisma's own .env loading only covers DATABASE_URL for its client.
try {
  process.loadEnvFile();
} catch {
  /* no .env present — fine */
}

import express from 'express';
import cors from 'cors';
import canvasRoutes from './routes/canvasRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import bubbleRoutes from './routes/bubbleRoutes.js';
import dependencyRoutes from './routes/dependencyRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import portalRoutes from './routes/portalRoutes.js';
import zoneRoutes from './routes/zoneRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import connectionRoutes from './routes/connectionRoutes.js';
import { initSync } from './integrations/syncEngine.js';

const app = express();
const port = process.env.PORT || 8085;

// Middleware — CORS only matters when the frontend is served from another origin;
// the Vite dev proxy makes requests same-origin, but this keeps direct access working.
app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());

// Routes
app.use('/api/canvases', canvasRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/bubbles', bubbleRoutes);
app.use('/api/dependencies', dependencyRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/portals', portalRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api', publicRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
  initSync().catch((e) => console.error('sync init failed:', e));
});

export default app;
