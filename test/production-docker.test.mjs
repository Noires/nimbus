import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('production Compose builds the server from the workspace root and starts only compiled JavaScript', async () => {
  const [compose, dockerfile, serverPackage] = await Promise.all([
    read('docker-compose.yml'),
    read('server/Dockerfile'),
    read('server/package.json'),
  ]);

  assert.match(compose, /server:\n\s+build:\n\s+context: \./);
  assert.match(compose, /dockerfile: server\/Dockerfile/);
  assert.match(dockerfile, /npm ci --omit=dev --workspace=server/);
  assert.match(dockerfile, /npm run build --workspace=server/);
  assert.ok(
    dockerfile.indexOf('npx prisma generate --schema=server/prisma/schema.prisma') < dockerfile.indexOf('npm run build --workspace=server'),
    'Prisma types must be generated before compiling the server',
  );
  assert.match(dockerfile, /CMD \["node", "dist\/index\.js"\]/);
  assert.match(serverPackage, /"build": "tsc"/);
  assert.doesNotMatch(dockerfile, /tsx/);
});

test('Compose gates the API on a healthy database and completed migration, preserving pgdata', async () => {
  const compose = await read('docker-compose.yml');

  assert.match(compose, /POSTGRES_PASSWORD: \$\{POSTGRES_PASSWORD:\?Set POSTGRES_PASSWORD before deploying\}/);
  assert.match(compose, /postgres:\$\{POSTGRES_PASSWORD:\?Set POSTGRES_PASSWORD before deploying\}@db:5432/);
  assert.match(compose, /healthcheck:\n\s+test: \["CMD-SHELL", "pg_isready/);
  assert.match(compose, /migrate:\n/);
  assert.match(compose, /command: \["npx", "prisma", "migrate", "deploy"/);
  assert.match(compose, /condition: service_healthy/);
  assert.match(compose, /condition: service_completed_successfully/);
  assert.match(compose, /pgdata:\/var\/lib\/postgresql\/data/);
  assert.match(compose, /pgdata:\n/);
});

test('the public Compose path proxies API health without publishing the server port', async () => {
  const [compose, server, nginx] = await Promise.all([
    read('docker-compose.yml'),
    read('server/src/index.ts'),
    read('frontend/nginx.conf'),
  ]);

  assert.match(server, /app\.get\('\/api\/health'/);
  assert.match(nginx, /location \/api\//);
  assert.doesNotMatch(compose, /server:\n[\s\S]*?ports:\n\s+- "8085:8085"/);
});
