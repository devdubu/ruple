import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import {
  Body, Controller, ForbiddenException, Get, Module, Post,
} from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { IsString, MaxLength } from 'class-validator';
import Ajv2020 from 'ajv/dist/2020';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './config';
import { createServiceApp, traceHeaders, type LogRecord, type ServiceOptions } from './runtime';

const validate = new Ajv2020().compile(JSON.parse(readFileSync('contracts/platform/http-v1.schema.json', 'utf8')));

class InputDto {
  @IsString()
  @MaxLength(16)
  value!: string;
}
@Controller('checks')
class CheckController {
  @Post('input')
  input(@Body() body: InputDto) { return { accepted: typeof body.value === 'string' }; }
  @Get('failure')
  failure(): never { throw new Error('private-database-string'); }
  @Get('forbidden')
  forbidden(): never { throw new ForbiddenException('private-policy-detail'); }
}
// Vitest's transform is not the production TypeScript compiler; provide the DTO metadata explicitly.
Reflect.defineMetadata('design:paramtypes', [InputDto], CheckController.prototype, 'input');
@Module({ controllers: [CheckController] })
class CheckModule {}

const apps: NestFastifyApplication[] = [];
async function open(options: Partial<ServiceOptions> = {}) {
  const app = await createServiceApp({ service: 'context-api', defaultPort: 3001,
    env: {}, log: () => {}, ...options });
  apps.push(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });
const development = { APP_ENV: 'test', AUTH_MODE: 'development', DEV_USER_ID: 'fixed-user' };

describe('configuration and identity boundary', () => {
  it.each([
    { PORT: '0' }, { PORT: '30.1' }, { PORT: '' }, { PORT: '65536' },
    { APP_ENV: 'invalid' }, { NODE_ENV: 'production', APP_ENV: 'development' },
    { APP_ENV: 'production', AUTH_MODE: 'development' },
    { AUTH_MODE: 'development', HOST: '0.0.0.0' },
    { APP_ENV: 'production', DOCS_ENABLED: 'true' },
    { DOCS_ENABLED: 'yes' }, { CORS_ORIGINS: '*' },
    { AUTH_MODE: 'development', DEV_USER_ID: '' },
  ])('rejects invalid or unsafe configuration %j', (env) => {
    expect(() => loadConfig(3001, env)).toThrow('Invalid configuration:');
  });

  it('denies protected requests by default even with forged identity headers', async () => {
    const app = await open();
    const response = await app.inject({ url: '/api/v1/runtime/context', headers: {
      'x-user-id': 'forged-user', 'x-device-id': 'forged-device', 'x-request-id': 'trace-1',
    } });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toMatchObject({ code: 'UNAUTHENTICATED', requestId: 'trace-1' });
    expect(validate(response.json())).toBe(true);
    expect((await app.inject({ url: '/health' })).statusCode).toBe(200);
    const readiness = await app.inject({ url: '/ready' });
    expect(readiness.statusCode).toBe(503);
    expect(validate(readiness.json())).toBe(true);
  });

  it('uses fixed development identity and keeps request IDs separate from authority', async () => {
    const app = await open({ env: development });
    const response = await app.inject({ url: '/api/v1/runtime/context', headers: {
      'x-user-id': 'forged-user', 'x-request-id': 'trace-2',
    } });
    expect(response.json()).toEqual({ requestId: 'trace-2', principal: { userId: 'fixed-user', source: 'development' } });
    expect(validate(response.json())).toBe(true);
    expect(traceHeaders(response.json())).toEqual({ 'x-request-id': 'trace-2' });
  });

  it('requires a verifier and uses only verified identity fields', async () => {
    await expect(open({ env: { AUTH_MODE: 'verified' } })).rejects.toThrow('verifier');
    const app = await open({ env: { AUTH_MODE: 'verified' }, verifyIdentity: async (request) =>
      request.headers.authorization === 'Bearer test-credential' ? { userId: 'verified-user' } : null });
    expect((await app.inject({ url: '/api/v1/runtime/context' })).statusCode).toBe(401);
    const response = await app.inject({ url: '/api/v1/runtime/context', headers: { authorization: 'Bearer test-credential' } });
    expect(response.json().principal).toEqual({ userId: 'verified-user', source: 'verified' });
    expect(validate(response.json())).toBe(true);
  });

  it('returns a sanitized dependency error when credential verification fails', async () => {
    const app = await open({ env: { AUTH_MODE: 'verified' }, verifyIdentity: async () => { throw new Error('private-verifier-detail'); } });
    const response = await app.inject({ url: '/api/v1/runtime/context' });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(response.body).not.toContain('private-verifier-detail');
  });
});

describe('HTTP contract, input validation, logs, and probes', () => {
  it('replaces invalid request IDs and echoes the same ID in error bodies and headers', async () => {
    const app = await open();
    const response = await app.inject({ url: '/missing', headers: { 'x-request-id': 'invalid request id' } });
    expect(response.statusCode).toBe(404);
    expect(response.headers['x-request-id']).not.toBe('invalid request id');
    expect(response.json().error.requestId).toBe(response.headers['x-request-id']);
    expect(validate(response.json())).toBe(true);
  });

  it('rejects malformed JSON, excess body fields, invalid values and oversized payloads', async () => {
    const app = await open({ env: development, module: CheckModule });
    for (const payload of [{ value: 123 }, { value: 'valid', extra: 'incoming-secret' }]) {
      const response = await app.inject({ method: 'POST', url: '/api/v1/checks/input', payload });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('INVALID_REQUEST');
      expect(response.body).not.toContain('incoming-secret');
      expect(validate(response.json())).toBe(true);
    }
    const malformed = await app.inject({ method: 'POST', url: '/api/v1/checks/input',
      headers: { 'content-type': 'application/json' }, payload: '{broken' });
    expect(malformed.statusCode).toBe(400);
    expect(validate(malformed.json())).toBe(true);
    const oversized = await app.inject({ method: 'POST', url: '/api/v1/checks/input',
      payload: { value: 'x'.repeat(1048577) } });
    expect(oversized.statusCode).toBe(413);
    expect(validate(oversized.json())).toBe(true);
    expect((await app.inject({ method: 'POST', url: '/api/v1/checks/input', payload: { value: 'valid' } })).statusCode).toBe(201);
  });

  it('never logs headers, bodies, raw URLs, identity values or exception details', async () => {
    const records: LogRecord[] = [];
    const app = await open({ env: development, module: CheckModule, log: (record) => records.push(record) });
    for (const [path, status] of [['failure', 500], ['forbidden', 403]] as const) {
      const response = await app.inject({ url: `/api/v1/checks/${path}?token=private-query`,
        headers: { authorization: 'Bearer private-credential', cookie: 'private-cookie', 'x-request-id': 'trace-errors' } });
      expect(response.statusCode).toBe(status);
      expect(response.body).not.toContain('private-');
      expect(validate(response.json())).toBe(true);
    }
    await app.inject({ url: '/private-place?token=private-query' });
    expect(records).toHaveLength(3);
    const serialized = JSON.stringify(records);
    for (const value of ['private-', 'fixed-user', 'authorization', 'cookie']) expect(serialized).not.toContain(value);
    expect(records[0]).toMatchObject({ requestId: 'trace-errors', route: '/api/v1/checks/failure', status: 500 });
  });

  it('separates liveness from failing or stalled dependencies', async () => {
    const app = await open({ env: development, readinessChecks: [async () => false] });
    expect((await app.inject({ url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/ready' })).json()).toEqual({ status: 'not_ready', service: 'context-api' });
    const stalled = await open({ env: development, readinessChecks: [() => new Promise(() => {})] });
    expect((await stalled.inject({ url: '/ready' })).statusCode).toBe(503);
    const ready = await open({ env: development });
    expect((await ready.inject({ url: '/ready' })).statusCode).toBe(200);
  });

  it('publishes versioned OpenAPI in development and hides docs in production', async () => {
    const app = await open();
    const response = await app.inject({ url: '/openapi.json' });
    expect(response.statusCode).toBe(200);
    const document = response.json();
    expect(document.paths['/api/v1/runtime/context'].get.responses['401'].content['application/json'].schema.$ref).toContain('ErrorEnvelope');
    expect(document.paths['/ready'].get.responses['503'].content['application/json'].schema.$ref).toContain('Readiness');
    const production = await open({ env: { APP_ENV: 'production' } });
    for (const url of ['/docs', '/openapi.json']) expect((await production.inject({ url })).statusCode).toBe(404);
  });

  it('allows browser access only from configured exact origins', async () => {
    const app = await open({ env: { CORS_ORIGINS: 'http://localhost:5173' } });
    const allowed = await app.inject({ url: '/health', headers: { origin: 'http://localhost:5173' } });
    const denied = await app.inject({ url: '/health', headers: { origin: 'https://untrusted.example' } });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
