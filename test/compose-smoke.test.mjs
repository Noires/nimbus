import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);

test('the Compose smoke test supplies an isolated database password to parameterized Compose', async () => {
  const scriptUrl = new URL('scripts/compose-smoke.sh', root);
  await access(scriptUrl, constants.X_OK);
  const script = await readFile(scriptUrl, 'utf8');

  assert.match(script, /docker compose -p "\$project"/);
  assert.match(script, /down -v --remove-orphans/);
  assert.match(script, /\/api\/health/);
  assert.match(script, /compose\.smoke\.yml/);
  assert.match(script, /export POSTGRES_PASSWORD=/);

  const override = await readFile(new URL('test/compose.smoke.yml', root), 'utf8');
  assert.match(override, /ports: !override/);
});
