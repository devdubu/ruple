import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { root, apiPorts, peerServices, scenarios, requireDevelopment } from './state.mjs';

const require = createRequire(import.meta.url);
export function loadRoutes() {
  const catalog = JSON.parse(readFileSync(path.join(root, 'contracts/catalog.json'), 'utf8'));
  const registry = JSON.parse(readFileSync(path.join(root, 'contracts/development/mock-routes.json'), 'utf8'));
  const validators = new Map();
  const examples = new Map();
  for (const contract of catalog.contracts) {
    const schema = JSON.parse(readFileSync(path.join(root, contract.schema), 'utf8'));
    validators.set(contract.id, addFormats(new Ajv2020()).compile(schema));
    examples.set(contract.id, JSON.parse(readFileSync(path.join(root, contract.example), 'utf8')).valid);
  }
  const keys = new Set();
  return registry.routes.map((route) => {
    const key = `${route.method} ${route.path}`;
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method) || !route.path.startsWith('/api/v1/')
      || route.path.includes('?') || keys.has(key) || !validators.has(route.contract)) throw new Error('Invalid mock route registration');
    keys.add(key);
    const lookup = (name) => {
      const fixture = examples.get(route.contract).find((item) => item.name === name);
      if (!fixture || !validators.get(route.contract)(fixture.value)) throw new Error('Mock must reference an approved valid contract example');
      return fixture.value;
    };
    if (!Number.isInteger(route.status) || route.status < 200 || route.status > 299) throw new Error('Mock success status must be 2xx');
    return { ...route, success: lookup(route.successExample),
      empty: route.emptyExample ? lookup(route.emptyExample) : undefined, validate: validators.get(route.contract) };
  });
}

export function createPeerMock({ service, state, routes = loadRoutes(), log = (entry) => console.info(JSON.stringify(entry)) }) {
  requireDevelopment();
  const { makeRequestId, errorEnvelope } = require('@ruple/platform-server');
  const validateHttp = addFormats(new Ajv2020()).compile(JSON.parse(readFileSync(path.join(root, 'contracts/platform/http-v1.schema.json'), 'utf8')));
  const server = createServer((request, response) => {
    const requestId = makeRequestId(request.headers['x-request-id']);
    response.setHeader('x-request-id', requestId);
    response.setHeader('x-ruple-mock', 'true');
    let scenario;
    const send = (status, body, validate = validateHttp) => {
      if (!validate(body)) { status = 500; body = errorEnvelope(500, requestId); }
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
      log({ event: 'development.mock.response', service, scenario, requestId, status });
    };
    try {
      const configuration = JSON.parse(readFileSync(path.join(state.directory, 'mocks.json'), 'utf8'))[service];
      scenario = configuration.scenario;
      if (!scenarios.includes(scenario)) throw new Error('Invalid mock scenario');
      const now = JSON.parse(readFileSync(path.join(state.directory, 'clock.json'), 'utf8')).now;
      if (!Number.isFinite(Date.parse(now))) throw new Error('Invalid mock clock');
      response.setHeader('x-ruple-test-clock', now);
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (request.method === 'GET' && pathname === '/health') return send(200, { status: 'ok', service: `${service}-api` });
      if (request.method === 'GET' && pathname === '/ready') {
        const available = !['offline', 'unavailable'].includes(scenario);
        return send(available ? 200 : 503, { status: available ? 'ready' : 'not_ready', service: `${service}-api` });
      }
      const route = routes.find((item) => item.path === pathname && item.method === request.method);
      if (!route) return send(404, errorEnvelope(404, requestId));
      if (scenario === 'offline') { request.socket.destroy(); return; }
      if (scenario === 'malformed') {
        response.writeHead(200, { 'content-type': 'application/json' }); response.end('{broken'); return;
      }
      const statuses = { unauthenticated: 401, forbidden: 403, conflict: 409, expired: 409, unavailable: 503, error: 500 };
      if (statuses[scenario]) return send(statuses[scenario], errorEnvelope(statuses[scenario], requestId));
      if (scenario === 'empty' && !route.empty) {
        response.setHeader('x-ruple-mock-detail', 'empty-example-not-registered');
        return send(503, errorEnvelope(503, requestId));
      }
      const body = structuredClone(scenario === 'empty' ? route.empty : route.success);
      if (body && typeof body === 'object') {
        if (Object.hasOwn(body, 'requestId')) body.requestId = requestId;
        if (body.error && Object.hasOwn(body.error, 'requestId')) body.error.requestId = requestId;
      }
      if (scenario === 'slow') {
        const delayMs = configuration.delayMs;
        if (!Number.isInteger(delayMs) || delayMs < 1 || delayMs > 60000) throw new Error('Invalid mock delay');
        const timer = setTimeout(() => { if (!response.destroyed) send(route.status, body, route.validate); }, delayMs);
        response.once('close', () => clearTimeout(timer));
        return;
      }
      return send(route.status, body, route.validate);
    } catch { return send(500, errorEnvelope(500, requestId)); }
  });
  return server;
}

export async function startPeerMocks(state) {
  requireDevelopment();
  const servers = [];
  try {
    for (const service of peerServices[state.track]) {
      const server = createPeerMock({ service, state });
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(apiPorts[service], '127.0.0.1', resolve);
      });
      console.info(JSON.stringify({ event: 'development.mock.started', service, port: apiPorts[service] }));
    }
  } catch (error) { await closePeerMocks(servers); throw error; }
  return servers;
}
export async function closePeerMocks(servers) {
  await Promise.all(servers.map((server) => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); })));
}
