import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { prepare, writeClock } from './state.mjs';
import { compose, migrateAndSeed, verifyDatabases } from './database.mjs';

const require = createRequire(import.meta.url);
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
for (const track of ['a', 'b']) test(`real PostgreSQL track ${track}: migration, ORM, seeds, and runtime privileges`, { timeout: 180000 }, async () => {
  const base = mkdtempSync(path.join(os.tmpdir(), 'ruple-database-integration-'));
  const ports = {};
  for (const service of track === 'a' ? ['context'] : ['automation', 'interaction']) ports[service] = await freePort();
  const state = prepare(track, base, ports);
  try {
    compose(state, ['up', '-d', '--wait', '--wait-timeout', '60']);
    await migrateAndSeed(state);
    await migrateAndSeed(state);
    await verifyDatabases(state);
    writeClock(state, '2026-04-01T00:00:00.000Z');
    await migrateAndSeed(state);
    for (const [service, config] of Object.entries(state.services)) {
      const { createDatabase, developmentProbe } = require(`../../packages/${service}/server/dist/index.js`);
      assert.throws(() => createDatabase(config.runtimeUrl.replace(config.database, 'unrelated')));
      const resource = createDatabase(config.runtimeUrl);
      try {
        assert.equal(await resource.ready(), true);
        const rows = await resource.db.select().from(developmentProbe);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].observedAt.toISOString(), '2026-04-01T00:00:00.000Z');
        await resource.db.insert(developmentProbe).values({ id: 'orm-roundtrip', value: 'synthetic', observedAt: new Date('2026-01-01T00:00:00.000Z') });
        assert.equal((await resource.db.select().from(developmentProbe)).length, 2);
        await resource.pool.query('DELETE FROM app.development_probe WHERE id = $1', ['orm-roundtrip']);
      } finally { await resource.close(); }
    }
  } finally {
    try { compose(state, ['down', '--volumes']); } finally { rmSync(base, { recursive: true, force: true }); }
  }
});
