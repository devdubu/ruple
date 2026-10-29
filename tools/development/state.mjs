import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const serviceDefinitions = {
  context: { track: 'a', port: 55431, database: 'ruple_context' },
  automation: { track: 'b', port: 55432, database: 'ruple_automation' },
  interaction: { track: 'b', port: 55433, database: 'ruple_interaction' },
};
export const scenarios = ['success', 'unauthenticated', 'forbidden', 'conflict', 'expired', 'unavailable', 'error', 'slow', 'offline', 'malformed', 'empty'];
export const peerServices = { a: ['automation', 'interaction', 'ai'], b: ['context', 'ai'] };
export const apiPorts = { context: 3001, automation: 3002, interaction: 3003, ai: 3010 };

export function requireDevelopment(env = process.env) {
  if (env.APP_ENV === 'production' || env.NODE_ENV === 'production') throw new Error('Development tools cannot run in production');
}
export function trackDirectory(track, base = path.join(root, 'local-artifacts/development')) {
  if (!['a', 'b'].includes(track)) throw new Error('Track must be a or b');
  return path.resolve(base, track);
}
function privateJson(file, value) {
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporary, file);
}
export function prepare(track, base, ports = {}) {
  requireDevelopment();
  const directory = trackDirectory(track, base);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'state.json');
  try { return loadState(track, base); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const image = JSON.parse(readFileSync(path.join(root, 'infra/development/images.lock.json'), 'utf8')).postgres;
  const state = { purpose: 'disposable-local-development', version: 1, track,
    project: `ruple-dev-${track}-${randomBytes(4).toString('hex')}`, image, services: {} };
  const environment = [`RUPLE_POSTGRES_IMAGE=${image}`];
  for (const [service, definition] of Object.entries(serviceDefinitions)) {
    if (definition.track !== track) continue;
    const port = Number(ports[service] ?? process.env[`${service.toUpperCase()}_DB_PORT`] ?? definition.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535
      || Object.values(state.services).some((item) => item.port === port)) throw new Error('Invalid or duplicate local database port');
    const credentials = Object.fromEntries(['admin', 'migration', 'runtime'].map((role) => [role, randomBytes(24).toString('hex')]));
    const connection = (role, username) => `postgresql://${username}:${credentials[role]}@127.0.0.1:${port}/${definition.database}`;
    state.services[service] = { port, database: definition.database,
      adminUrl: connection('admin', 'ruple_admin'), migrationUrl: connection('migration', 'ruple_migrator'), runtimeUrl: connection('runtime', 'ruple_runtime') };
    environment.push(`${service.toUpperCase()}_DB_PORT=${port}`);
    for (const [role, password] of Object.entries(credentials)) environment.push(`${service.toUpperCase()}_${role.toUpperCase()}_PASSWORD=${password}`);
  }
  // Compose requires values for inactive profiles too; never use these as actual credentials.
  for (const [service, definition] of Object.entries(serviceDefinitions)) {
    if (definition.track === track) continue;
    for (const role of ['ADMIN', 'MIGRATION', 'RUNTIME']) environment.push(`${service.toUpperCase()}_${role}_PASSWORD=inactive-profile`);
  }
  privateJson(file, state);
  privateJson(path.join(directory, 'clock.json'), { now: '2026-01-01T00:00:00.000Z' });
  privateJson(path.join(directory, 'mocks.json'), Object.fromEntries(peerServices[track].map((service) => [service, { scenario: 'success', delayMs: 1500 }])));
  writeFileSync(path.join(directory, 'compose.env'), environment.join('\n') + '\n', { mode: 0o600 });
  return loadState(track, base);
}
export function loadState(track, base) {
  requireDevelopment();
  const directory = trackDirectory(track, base);
  const state = JSON.parse(readFileSync(path.join(directory, 'state.json'), 'utf8'));
  if (state.purpose !== 'disposable-local-development' || state.version !== 1 || state.track !== track
    || !new RegExp(`^ruple-dev-${track}-[a-f0-9]{8}$`).test(state.project)) throw new Error('Invalid disposable database state');
  const expected = Object.keys(serviceDefinitions).filter((key) => serviceDefinitions[key].track === track);
  if (JSON.stringify(Object.keys(state.services).sort()) !== JSON.stringify(expected.sort())) throw new Error('Invalid service database selection');
  for (const [service, configuration] of Object.entries(state.services)) {
    for (const [role, username] of [['admin', 'ruple_admin'], ['migration', 'ruple_migrator'], ['runtime', 'ruple_runtime']]) {
      const url = new URL(configuration[`${role}Url`]);
      if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1'
        || Number(url.port) !== configuration.port || url.pathname !== `/${serviceDefinitions[service].database}`
        || url.username !== username || !/^[a-f0-9]{48}$/.test(url.password) || url.search || url.hash) {
        throw new Error('Only generated local database settings are accepted');
      }
    }
  }
  return { ...state, directory };
}
export function setScenario(state, service, scenario) {
  requireDevelopment();
  if (!peerServices[state.track].includes(service) || !scenarios.includes(scenario)) throw new Error('Invalid peer or mock scenario');
  const file = path.join(state.directory, 'mocks.json');
  const mocks = JSON.parse(readFileSync(file, 'utf8'));
  mocks[service] = { ...mocks[service], scenario };
  privateJson(file, mocks);
}
export function writeClock(state, now) { privateJson(path.join(state.directory, 'clock.json'), { now }); }
