// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { parseRuntimeContext } from '@ruple/platform';
import { AppQueryProvider, serviceQueryKey, useQuery } from './query';
import { ApiClientsProvider, useApiClient } from './api-context';
import { createApiClient } from './client';

afterEach(cleanup);
function PrivateData({ value }: { value: string }) {
  const query = useQuery({ queryKey: ['private-data'], queryFn: async () => value });
  return <p>{query.data ?? '불러오는 중'}</p>;
}

it('discards old account data when the cache scope changes', async () => {
  const { rerender } = render(<AppQueryProvider scope="session-a"><PrivateData value="계정 A 내용" /></AppQueryProvider>);
  expect(await screen.findByText('계정 A 내용')).toBeVisible();
  rerender(<AppQueryProvider scope="session-b"><PrivateData value="계정 B 내용" /></AppQueryProvider>);
  expect(screen.queryByText('계정 A 내용')).not.toBeInTheDocument();
  expect(await screen.findByText('계정 B 내용')).toBeVisible();
});

it('lets feature UI use an injected service without importing application configuration', async () => {
  const client = createApiClient({ baseUrl: '/services/context', fetch: async (_url, init) => {
    const id = (init?.headers as Record<string, string>)['x-request-id'];
    return Response.json({ requestId: id, principal: { userId: 'example-user', source: 'verified' } });
  } });
  function ExampleFeature() {
    const api = useApiClient('context');
    const result = useQuery({ queryKey: serviceQueryKey('context', 'runtime-context'),
      queryFn: ({ signal }) => api.get('/api/v1/runtime/context', parseRuntimeContext, { signal }) });
    return <p>{result.data?.principal.userId ?? '불러오는 중'}</p>;
  }
  render(<AppQueryProvider scope="example-session"><ApiClientsProvider clients={{ context: client, automation: client, interaction: client, ai: client }}>
    <ExampleFeature />
  </ApiClientsProvider></AppQueryProvider>);
  expect(await screen.findByText('example-user')).toBeVisible();
});
