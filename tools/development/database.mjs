import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { root, requireDevelopment } from './state.mjs';

function runDocker(args, extra = {}) {
  const env = { ...process.env }; delete env.DOCKER_CONTEXT;
  const result = spawnSync('docker', args, { env, encoding: 'utf8', timeout: 120000, ...extra });
  if (result.error || result.status !== 0) {
    // Never dump generated environment/DSNs or Docker configuration into logs.
    throw new Error('Local Docker command failed; inspect the disposable project with Docker locally');
  }
  return result.stdout.trim();
}
function localEndpoint() {
  const endpoint = process.env.DOCKER_HOST
    ?? runDocker(['context', 'inspect', ...(process.env.DOCKER_CONTEXT ? [process.env.DOCKER_CONTEXT] : []), '--format', '{{.Endpoints.docker.Host}}']);
  if (!endpoint.startsWith('unix://') && !endpoint.startsWith('npipe://')
    && !/^tcp:\/\/(127\.0\.0\.1|localhost):\d+$/.test(endpoint)) throw new Error('Development databases require a local Docker endpoint');
  return endpoint;
}
export function compose(state, command) {
  requireDevelopment();
  const endpoint = localEndpoint();
  return runDocker([`--host=${endpoint}`, 'compose', '--env-file', path.join(state.directory, 'compose.env'),
    '-f', path.join(root, 'infra/development/compose.json'), '-p', state.project, '--profile', state.track, ...command]);
}
export async function migrateAndSeed(state, { seed = true } = {}) {
  requireDevelopment();
  const now = JSON.parse(readFileSync(path.join(state.directory, 'clock.json'), 'utf8')).now;
  for (const [service, config] of Object.entries(state.services)) {
    const pool = new pg.Pool({ connectionString: config.migrationUrl, connectionTimeoutMillis: 3000 });
    try {
      await migrate(drizzle(pool), { migrationsFolder: path.join(root, `packages/${service}/server/db/migrations`) });
      if (seed) await pool.query(`INSERT INTO app.development_probe(id, value, observed_at) VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, observed_at = EXCLUDED.observed_at`, ['baseline', `${service}-synthetic-fixture`, now]);
    } finally { await pool.end(); }
  }
}
export async function verifyDatabases(state) {
  requireDevelopment();
  for (const [service, config] of Object.entries(state.services)) {
    const client = new pg.Client({ connectionString: config.runtimeUrl, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      const result = await client.query('SELECT id, value, observed_at FROM app.development_probe WHERE id = $1', ['baseline']);
      if (result.rowCount !== 1 || result.rows[0].value !== `${service}-synthetic-fixture`) throw new Error('Development seed is missing');
      for (const sql of ['CREATE TABLE app.forbidden_probe(id text)', 'SELECT * FROM drizzle.__drizzle_migrations', "CREATE ROLE forbidden_probe"]) {
        try { await client.query(sql); throw new Error('Runtime role unexpectedly gained administrative privileges'); }
        catch (error) { if (error.code !== '42501') throw error; }
      }
    } finally { await client.end(); }
    const forbidden = new URL(config.runtimeUrl); forbidden.pathname = '/postgres';
    const outsider = new pg.Client({ connectionString: forbidden.href, connectionTimeoutMillis: 3000 });
    try {
      try { await outsider.connect(); throw new Error('Runtime role can access an unrelated database'); }
      catch (error) { if (error.code !== '42501') throw error; }
    } finally { await outsider.end().catch(() => {}); }
  }
}
