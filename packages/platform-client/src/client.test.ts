import { parseRuntimeContext } from '@ruple/platform';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';
import { createAppQueryClient } from './query';

const identity = { userId: 'example-user', source: 'verified' };
const decode = (value: unknown) => value;
afterEach(() => vi.useRealTimers());

describe('API transport', () => {
  it('validates responses, propagates a request ID, and sends only explicit credentials', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      return Response.json({ requestId: headers['x-request-id'], principal: identity },
        { headers: { 'x-request-id': headers['x-request-id'] } });
    });
    const client = createApiClient({ baseUrl: '/services/context', fetch, getAccessToken: () => 'test-credential' });
    const result = await client.get('/api/v1/runtime/context', parseRuntimeContext);
    expect(result.principal.userId).toBe('example-user');
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe('/services/context/api/v1/runtime/context');
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'error',
      headers: { authorization: 'Bearer test-credential', 'x-request-id': result.requestId } });
    expect(fetch.mock.calls[0][1]?.headers).not.toHaveProperty('x-user-id');
  });

  it('localizes approved errors without displaying raw server messages', async () => {
    const client = createApiClient({ baseUrl: '/services/context', fetch: async () => Response.json({
      error: { code: 'UNAUTHENTICATED', message: 'private-provider-detail', requestId: 'trace-401' },
    }, { status: 401, headers: { 'x-request-id': 'trace-401' } }) });
    await expect(client.get('/api/v1/runtime/context', decode)).rejects.toMatchObject({
      kind: 'http', status: 401, code: 'UNAUTHENTICATED', requestId: 'trace-401', message: '로그인이 필요해요.',
    });
  });

  it.each([
    () => new Response('<html>private-body</html>', { status: 502 }),
    () => Response.json({ error: { code: 'UNKNOWN', message: 'private-body', requestId: 'trace-error' } }, { status: 400 }),
    () => Response.json({ error: { code: 'FORBIDDEN', message: 'Access is denied.', requestId: 'body-id' } }, { status: 403, headers: { 'x-request-id': 'different-id' } }),
  ])('rejects malformed or inconsistent upstream responses', async (response) => {
    const client = createApiClient({ baseUrl: '/services/context', fetch: async () => response() });
    await expect(client.get('/api/v1/runtime/context', decode)).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('requires successful response decoding and sanitizes network failures', async () => {
    const invalid = createApiClient({ baseUrl: '/services/context', fetch: async () => Response.json({ private: 'detail' }) });
    await expect(invalid.get('/api/v1/runtime/context', parseRuntimeContext)).rejects.toMatchObject({ kind: 'invalid-response' });
    const offline = createApiClient({ baseUrl: '/services/context', fetch: async () => { throw new Error('private-network-detail'); } });
    await expect(offline.get('/api/v1/runtime/context', decode)).rejects.toMatchObject({ kind: 'network', message: '네트워크 연결을 확인해주세요.' });
  });

  it('blocks URL escapes before credentials are obtained', async () => {
    const token = vi.fn(() => 'test-credential');
    const fetch = vi.fn<typeof globalThis.fetch>();
    const client = createApiClient({ baseUrl: '/services/context', fetch, getAccessToken: token });
    for (const path of ['//untrusted.example', '/\\untrusted.example', '/../interaction/action', '/%2e%2e/interaction/action']) {
      await expect(client.get(path, decode)).rejects.toBeInstanceOf(ApiError);
    }
    expect(token).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(() => createApiClient({ baseUrl: '//untrusted.example' })).toThrow(ApiError);
  });

  it('times out even when a credential provider never resolves', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>();
    const client = createApiClient({ baseUrl: '/services/context', timeoutMs: 20, fetch,
      getAccessToken: () => new Promise(() => {}) });
    const assertion = expect(client.get('/api/v1/runtime/context', decode)).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(21);
    await assertion;
    expect(fetch).not.toHaveBeenCalled();
  });

  it('cancels an in-flight request without retrying', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise(() => {}));
    const client = createApiClient({ baseUrl: '/services/context', fetch });
    const controller = new AbortController();
    const assertion = expect(client.get('/api/v1/runtime/context', decode, { signal: controller.signal })).rejects.toMatchObject({ kind: 'aborted' });
    await Promise.resolve();
    controller.abort();
    await assertion;
    expect(fetch).toHaveBeenCalledOnce();
  });
});

it('does not automatically replay failed reads or mutations', async () => {
  const client = createAppQueryClient();
  const read = vi.fn(async () => { throw new Error('example-failure'); });
  await expect(client.fetchQuery({ queryKey: ['test'], queryFn: read })).rejects.toThrow();
  expect(read).toHaveBeenCalledOnce();
  const write = vi.fn(async () => { throw new Error('example-failure'); });
  const mutation = client.getMutationCache().build(client, { mutationFn: write });
  await expect(mutation.execute(undefined)).rejects.toThrow();
  expect(write).toHaveBeenCalledOnce();
  client.clear();
});
