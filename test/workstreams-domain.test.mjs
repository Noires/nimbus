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

test('command-center keeps compact desktop context out of the primary grid and preserves mobile companion routing', async () => {
  const [shell, css, mobileRoute, mobileRules] = await Promise.all([
    read('frontend/src/components/SpatialCommandCenterShell.tsx'),
    read('frontend/src/global.css'),
    read('frontend/src/components/CanvasRouter.tsx'),
    read('frontend/src/components/mobileCommandCenter.ts'),
  ]);

  assert.match(shell, /command-center-shell--with-rail/);
  assert.match(css, /@media \(min-width: 769px\) and \(max-width: 1100px\) \{[\s\S]*?grid-template-columns: minmax\(12rem, 14rem\) minmax\(0, 1fr\);[\s\S]*?\.command-center-shell__rail \{[\s\S]*?grid-column: 2;[\s\S]*?justify-self: end;/);
  assert.match(css, /\.command-center-shell__commands \{[\s\S]*?min-height: 10rem;[\s\S]*?padding: 1rem 0;/);
  assert.doesNotMatch(css, /@media \(max-width: 768px\) \{\s*\.command-center-shell \{/);
  assert.match(mobileRules, /MOBILE_COMMAND_CENTER_QUERY = "\(max-width: 768px\)"/);
  assert.match(mobileRules, /return viewport === "narrow";/);
  assert.match(mobileRoute, /if \(mobileCommandCenter\) \{[\s\S]*?<MobileCommandCenter/);
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
