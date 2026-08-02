import assert from 'node:assert/strict';
import { test } from 'node:test';

const baseUrl = process.env.NIMBUS_TEST_BASE_URL;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

async function createCanvas(name) {
  const { response, body } = await request('/api/canvases', { method: 'POST', body: JSON.stringify({ name }) });
  assert.equal(response.status, 200);
  return body;
}

async function createTask(canvasId, title, patch = {}) {
  const { response, body } = await request('/api/tasks', { method: 'POST', body: JSON.stringify({ canvasId, title, ...patch }) });
  assert.equal(response.status, 201);
  return body;
}

test('Blocker Links v1 persists set, replace, clear, validation, and concurrent cycle rejection', { skip: !baseUrl }, async () => {
  const canvas = await createCanvas('Blocker integration');
  const otherCanvas = await createCanvas('Other canvas');
  const [a, b, c, done, target, concurrentA, concurrentB] = await Promise.all([
    createTask(canvas.id, 'A'),
    createTask(canvas.id, 'B'),
    createTask(canvas.id, 'C'),
    createTask(canvas.id, 'Done blocker', { done: true }),
    createTask(canvas.id, 'Target'),
    createTask(canvas.id, 'Concurrent A'),
    createTask(canvas.id, 'Concurrent B'),
  ]);
  const foreign = await createTask(otherCanvas.id, 'Foreign');

  let result = await request(`/api/tasks/${target.id}/blocker`, { method: 'PUT', body: JSON.stringify({ blockerId: a.id }) });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.blockerId, a.id);
  result = await request(`/api/tasks/${target.id}/blocker`, { method: 'PUT', body: JSON.stringify({ blockerId: b.id }) });
  assert.equal(result.response.status, 200);
  result = await request(`/api/dependencies?canvasId=${canvas.id}`);
  assert.deepEqual(result.body.filter((dependency) => dependency.blockedId === target.id).map((dependency) => dependency.blockerId), [b.id]);
  result = await request(`/api/tasks/${target.id}/blocker`, { method: 'DELETE' });
  assert.equal(result.response.status, 204);
  result = await request(`/api/dependencies?canvasId=${canvas.id}`);
  assert.equal(result.body.some((dependency) => dependency.blockedId === target.id), false);

  for (const blockerId of [done.id, foreign.id, a.id]) {
    const blockedId = blockerId === a.id ? a.id : target.id;
    result = await request(`/api/tasks/${blockedId}/blocker`, { method: 'PUT', body: JSON.stringify({ blockerId }) });
    assert.equal(result.response.status, 400);
  }

  assert.equal((await request(`/api/tasks/${b.id}/blocker`, { method: 'PUT', body: JSON.stringify({ blockerId: a.id }) })).response.status, 200);
  assert.equal((await request(`/api/tasks/${c.id}/blocker`, { method: 'PUT', body: JSON.stringify({ blockerId: b.id }) })).response.status, 200);
  result = await request(`/api/tasks/${a.id}/blocker`, { method: 'PUT', body: JSON.stringify({ blockerId: c.id }) });
  assert.equal(result.response.status, 400);

  const concurrent = await Promise.all([
    request(`/api/tasks/${concurrentA.id}/blocker`, { method: 'PUT', body: JSON.stringify({ blockerId: concurrentB.id }) }),
    request(`/api/tasks/${concurrentB.id}/blocker`, { method: 'PUT', body: JSON.stringify({ blockerId: concurrentA.id }) }),
  ]);
  assert.ok(concurrent.some(({ response }) => response.status === 200));
  assert.ok(concurrent.some(({ response }) => response.status === 400 || response.status === 409));
  result = await request(`/api/dependencies?canvasId=${canvas.id}`);
  const concurrentEdges = result.body.filter((dependency) => [concurrentA.id, concurrentB.id].includes(dependency.blockedId));
  assert.equal(concurrentEdges.length, 1);
});
