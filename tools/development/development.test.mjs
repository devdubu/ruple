import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { childEnvironment } from './cli.mjs';
import { loadState, prepare, requireDevelopment, setScenario, writeClock } from './state.mjs';
import { closePeerMocks, createPeerMock, loadRoutes } from './mocks.mjs';

function fixture(t, track = 'b') {
  const base = mkdtempSync(path.join(os.tmpdir(), 'ruple-development-unit-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  return { base, state: prepare(track, base) };
}
test('generated settings are private, stable, local, and track scoped', (t) => {
  const { base, state } = fixture(t);
  assert.deepEqual(Object.keys(state.services), ['automation', 'interaction']);
  assert.equal(prepare('b', base).project, state.project);
  if (process.platform !== 'win32') {
    for (const file of ['state.json', 'compose.env', 'clock.json', 'mocks.json']) {
      assert.equal(statSync(path.join(state.directory, file)).mode & 0o777, 0o600);
    }
  }
  const file = path.join(state.directory, 'state.json');
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  saved.services.automation.runtimeUrl = saved.services.automation.runtimeUrl.replace('127.0.0.1', 'remote.example');
  writeFileSync(file, JSON.stringify(saved));
  assert.throws(() => loadState('b', base));
  assert.throws(() => prepare('c', base));
  assert.throws(() => requireDevelopment({ NODE_ENV: 'production' }));
  assert.throws(() => requireDevelopment({ APP_ENV: 'production' }));
});
test('each process receives only its runtime DSN; web receives none', (t) => {
  const { state } = fixture(t);
  for (const project of ['automation-api', 'automation-worker', 'interaction-api', 'web']) {
    const env = childEnvironment(state, project);
    const keys = Object.keys(env).filter((key) => /^(CONTEXT|AUTOMATION|INTERACTION)_(DATABASE|MIGRATION)_URL$/.test(key));
    const expected = project.startsWith('automation') ? ['AUTOMATION_DATABASE_URL']
      : project === 'interaction-api' ? ['INTERACTION_DATABASE_URL'] : [];
    assert.deepEqual(keys, expected);
    assert.equal(env.AUTH_MODE, 'development');
    assert.equal(env.HOST, '127.0.0.1');
  }
  assert.throws(() => setScenario(state, 'automation', 'success'));
  assert.throws(() => setScenario(state, 'context', 'unknown'));
});
test('peer HTTP responses use registered contracts and explicit failure fixtures', async (t) => {
  const { state } = fixture(t);
  const routes = loadRoutes();
  assert.ok(routes.length > 0);
  const server = createPeerMock({ service: 'context', state, routes, log: () => {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => closePeerMocks([server]));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = () => fetch(`${base}/api/v1/runtime/context`);
  const successful = await get();
  assert.equal(successful.status, 200);
  assert.equal(successful.headers.get('x-ruple-mock'), 'true');
  assert.ok(routes[0].validate(await successful.json()));
  for (const [scenario, status] of Object.entries({ unauthenticated: 401, forbidden: 403, conflict: 409, expired: 409, unavailable: 503, error: 500 })) {
    setScenario(state, 'context', scenario);
    const response = await get();
    assert.equal(response.status, status);
    assert.ok(routes[0].validate(await response.json()));
  }
  setScenario(state, 'context', 'malformed');
  await assert.rejects((await get()).json());
  setScenario(state, 'context', 'offline');
  await assert.rejects(get());
  setScenario(state, 'context', 'empty');
  assert.equal((await get()).headers.get('x-ruple-mock-detail'), 'empty-example-not-registered');
  setScenario(state, 'context', 'slow');
  await assert.rejects(fetch(`${base}/api/v1/runtime/context`, { signal: AbortSignal.timeout(30) }));
  setScenario(state, 'context', 'success');
  writeClock(state, '2026-04-01T00:00:00.000Z');
  assert.equal((await get()).headers.get('x-ruple-test-clock'), '2026-04-01T00:00:00.000Z');
  const unsafe = await fetch(`${base}/api/v1/vehicle/execute`, { method: 'POST' });
  assert.equal(unsafe.status, 404);
});
