import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('blocker links persist one blocker per task and use an atomic task blocker endpoint', async () => {
  const [schema, routes, migration, dependencies] = await Promise.all([
    read('server/prisma/schema.prisma'),
    read('server/src/routes/taskRoutes.ts'),
    read('server/prisma/migrations/20260802150000_task_blockers/migration.sql'),
    read('server/src/routes/dependencyRoutes.ts'),
  ]);

  assert.match(schema, /@@unique\(\[blockedId\]\)/);
  assert.match(migration, /CREATE UNIQUE INDEX "dependencies_blockedId_key" ON "dependencies"\("blockedId"\)/);
  assert.match(routes, /router\.put\("\/:id\/blocker"/);
  assert.match(routes, /router\.delete\("\/:id\/blocker"/);
  assert.match(routes, /pg_advisory_xact_lock/);
  assert.match(routes, /isolationLevel: "Serializable"/);
  assert.match(routes, /blocker\.done/);
  // The pre-v1 canvas graph endpoint remains available, but it must share the
  // atomic one-blocker validation rather than bypassing the durable invariant.
  assert.match(dependencies, /replaceTaskBlocker\(blockedId, blockerId, false\)/);
  assert.match(dependencies, /BlockerLinkError/);
  assert.match(dependencies, /P2034/);
});
