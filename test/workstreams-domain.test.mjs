import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('workstream persistence permits explicit multi-membership without persisting proximity suggestions', async () => {
  const [schema, migration, routes] = await Promise.all([
    read('server/prisma/schema.prisma'),
    read('server/prisma/migrations/20260727170000_workstreams/migration.sql'),
    read('server/src/routes/workstreamRoutes.ts'),
  ]);

  assert.match(schema, /model TaskWorkstream[\s\S]*?@@id\(\[taskId, workstreamId\]\)/);
  assert.match(migration, /CREATE TABLE "workstreams"/);
  assert.match(migration, /CREATE TABLE "task_workstreams"/);
  assert.match(routes, /prisma\.taskWorkstream\.upsert/);
  assert.doesNotMatch(routes, /prisma\.bubble/);
  assert.doesNotMatch(schema, /Proximity(?:Cluster|Suggestion)/);
});

test('workstream creation accepts an omitted description as null', async () => {
  const routes = await read('server/src/routes/workstreamRoutes.ts');

  assert.match(routes, /const validDescription = parsedDescription \?\? null;/);
  assert.match(routes, /description !== undefined && parsedDescription === undefined/);
  assert.match(routes, /data: \{ canvasId, name: validName, description: validDescription,/);
});

test('command-center reserves a desktop grid column and full-height scrollable row for the optional rail', async () => {
  const [shell, css] = await Promise.all([
    read('frontend/src/components/SpatialCommandCenterShell.tsx'),
    read('frontend/src/global.css'),
  ]);

  assert.match(shell, /command-center-shell--with-rail/);
  assert.match(css, /\.command-center-shell--with-rail \{\s*grid-template-columns: minmax\(13rem, 16rem\) minmax\(0, 1fr\) minmax\(16rem, 22rem\);/);
  assert.match(css, /\.command-center-shell__rail \{\s*grid-column: 3;\s*grid-row: 1 \/ -1;[\s\S]*?overflow-y: auto;/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*?\.command-center-shell__rail \{\s*display: none;/);
});

test('task deletion broadcasts each affected workstream with memberships already cleaned', async () => {
  const routes = await read('server/src/routes/taskRoutes.ts');

  assert.match(routes, /include: \{[\s\S]*?workstreams: \{ select: \{ workstreamId: true \} \}/);
  assert.match(routes, /const \{ deletedTask, affectedWorkstreams \} = await prisma\.\$transaction/);
  assert.match(routes, /await tx\.task\.delete\(\{ where: \{ id: req\.params\.id \} \}\)/);
  assert.match(routes, /tx\.workstream\.findMany\([\s\S]*?memberships: \{ select: \{ taskId: true \} \}/);
  assert.match(routes, /for \(const workstream of affectedWorkstreams\) \{[\s\S]*?entity: "workstream", action: "upsert", data: workstream/);
});

test('bulk task position updates validate one canvas and execute all writes in one transaction', async () => {
  const routes = await read('server/src/routes/taskRoutes.ts');

  assert.match(routes, /router\.post\("\/positions"/);
  assert.match(routes, /const positions = parsePositionUpdates\(req\.body\?\.positions\);/);
  assert.match(routes, /const saved = await prisma\.\$transaction\(async \(tx\) => \{/);
  assert.match(routes, /const tasks = await tx\.task\.findMany\(\{[\s\S]*?canvasId/);
  assert.match(routes, /if \(tasks\.length !== positions\.length\)/);
  assert.match(routes, /await tx\.task\.update\(/);
  assert.match(routes, /publish\(task\.canvasId, \{ entity: "task", action: "upsert"/);
});
