import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createFixedClock } from '../../packages/platform/src/clock.ts';
import { compose, migrateAndSeed, verifyDatabases } from './database.mjs';
import { apiPorts, peerServices, prepare, requireDevelopment, root, setScenario, writeClock } from './state.mjs';
import { closePeerMocks, loadRoutes, startPeerMocks } from './mocks.mjs';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
function buildRuntime() {
  const result = spawnSync(pnpm, ['nx', 'build', 'platform-server'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Build the common runtime before local development');
}
function generateMigration(state, service) {
  if (!state.services[service]) throw new Error('Service does not belong to the selected track');
  const result = spawnSync(pnpm, ['exec', 'drizzle-kit', 'generate', '--config', `packages/${service}/server/drizzle.config.ts`], {
    cwd: root, stdio: 'inherit', env: { ...process.env, [`${service.toUpperCase()}_MIGRATION_URL`]: state.services[service].migrationUrl },
  });
  if (result.status !== 0) throw new Error('Migration generation failed');
}
export function childEnvironment(state, project) {
  const env = { ...process.env, APP_ENV: 'development', NODE_ENV: 'development', AUTH_MODE: 'development',
    HOST: '127.0.0.1', VITE_DEV_TRACK: state.track, VITE_UI_PREVIEW: 'false', RUPLE_DEV_STATE_DIR: state.directory };
  delete env.DATABASE_URL;
  for (const service of ['context', 'automation', 'interaction']) {
    delete env[`${service.toUpperCase()}_DATABASE_URL`];
    delete env[`${service.toUpperCase()}_MIGRATION_URL`];
  }
  const service = project === 'automation-worker' ? 'automation' : project.replace(/-api$/, '');
  if (state.services[service]) env[`${service.toUpperCase()}_DATABASE_URL`] = state.services[service].runtimeUrl;
  return env;
}
async function runIsolated(state) {
  buildRuntime();
  const servers = await startPeerMocks(state);
  const projects = state.track === 'a' ? ['web', 'context-api'] : ['web', 'automation-api', 'automation-worker', 'interaction-api'];
  const children = projects.map((project) => spawn(pnpm, ['nx', 'serve', project, '--output-style=stream'], {
    cwd: root, env: childEnvironment(state, project), stdio: 'inherit', detached: process.platform !== 'win32',
  }));
  let stopping = false;
  let interrupted = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    for (const child of children) {
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      else { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
    }
    await closePeerMocks(servers);
    const timer = setTimeout(() => {
      for (const child of children) if (child.pid && child.exitCode === null && child.signalCode === null) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      }
    }, 3000);
    await Promise.all(children.map((child) => child.exitCode !== null || child.signalCode !== null ? undefined
      : new Promise((resolve) => child.once('exit', resolve))));
    clearTimeout(timer);
  };
  const signal = () => { interrupted = true; void stop(); };
  process.once('SIGTERM', signal); process.once('SIGINT', signal);
  const result = await Promise.race(children.map((child) => new Promise((resolve, reject) => {
    child.once('error', reject); child.once('exit', (code) => resolve(code));
  })));
  await stop();
  process.removeListener('SIGTERM', signal); process.removeListener('SIGINT', signal);
  if (!interrupted && result !== 0) process.exitCode = result ?? 1;
}

export async function run(args) {
  requireDevelopment();
  const [action, track, ...extra] = args;
  const state = prepare(track);
  if (action === 'prepare') { console.info(`Prepared disposable track ${track} settings (credentials kept locally)`); return; }
  if (action === 'up') {
    compose(state, ['up', '-d', '--wait', '--wait-timeout', '60']);
    await migrateAndSeed(state);
    await verifyDatabases(state);
    console.info(`Track ${track} databases initialized; runtime privileges verified`); return;
  }
  if (action === 'down') { compose(state, ['down']); console.info(`Track ${track} stopped; volumes retained`); return; }
  if (action === 'reset') {
    if (!extra.includes('--confirm-local-reset')) throw new Error('Reset requires --confirm-local-reset and removes only this disposable project volumes');
    compose(state, ['down', '--volumes']);
    compose(state, ['up', '-d', '--wait', '--wait-timeout', '60']);
    await migrateAndSeed(state); await verifyDatabases(state);
    console.info(`Track ${track} disposable databases reset`); return;
  }
  if (action === 'migrate' || action === 'seed') {
    await migrateAndSeed(state, { seed: action === 'seed' });
    console.info(`Track ${track} ${action} completed`); return;
  }
  if (action === 'verify') { await verifyDatabases(state); console.info(`Track ${track} database access verified`); return; }
  if (action === 'generate') { generateMigration(state, extra[0]); return; }
  if (action === 'dev') return runIsolated(state);
  if (action === 'mocks') {
    buildRuntime(); const servers = await startPeerMocks(state);
    const stop = async () => { await closePeerMocks(servers); process.exitCode = 0; };
    process.once('SIGINT', stop); process.once('SIGTERM', stop); return;
  }
  if (action === 'scenario') {
    const routes = loadRoutes();
    if (extra[1] === 'empty' && routes.some((route) => !route.empty)) throw new Error('Register approved empty examples before enabling empty responses');
    setScenario(state, extra[0], extra[1]); console.info(`Mock ${extra[0]} scenario set to ${extra[1]}`); return;
  }
  if (action === 'clock') {
    const current = JSON.parse(readFileSync(path.join(state.directory, 'clock.json'), 'utf8'));
    const clock = createFixedClock(extra[0] === 'set' ? extra[1] : current.now);
    if (extra[0] === 'advance') clock.advanceBy(Number(extra[1]));
    if (!['show', 'set', 'advance'].includes(extra[0])) throw new Error('Clock action must be show, set, or advance');
    writeClock(state, clock.now().toISOString()); console.info(clock.now().toISOString()); return;
  }
  throw new Error('Unknown development action');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run(process.argv.slice(2)).catch((error) => {
    // Error messages from external drivers may include credentials; expose only a stable code.
    console.error(JSON.stringify({ event: 'development.command.failed', code: error.code ?? 'LOCAL_SETUP_ERROR',
      hint: 'Check track, local Docker, generated settings, and documented command arguments' }));
    process.exitCode = 1;
  });
}
