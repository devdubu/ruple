import { afterEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from './app';

describe('interaction-api standalone HTTP application', () => {
  let app: NestFastifyApplication | undefined;
  afterEach(async () => { await app?.close(); });

  it('boots without a DB, AI, or peer service and responds to an HTTP probe', async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'interaction-api' });
  });

  it('has no business endpoint in the foundation skeleton', async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const response = await app.inject({ method: 'POST', url: '/routines' });
    expect(response.statusCode).toBe(404);
  });
});
