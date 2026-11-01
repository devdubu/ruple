import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import type { ApiService } from './api-context';

export function serviceQueryKey(service: ApiService, ...parts: readonly unknown[]) {
  return [service, ...parts] as const;
}

export function createAppQueryClient() {
  return new QueryClient({ defaultOptions: {
    queries: { retry: false, staleTime: 30000, gcTime: 300000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  } });
}

function ScopedProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createAppQueryClient);
  useEffect(() => () => { void client.cancelQueries(); client.clear(); }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// Scope is an opaque account/vehicle session boundary, never an access token.
export function AppQueryProvider({ scope, children }: { scope: string; children: ReactNode }) {
  if (!scope.trim()) throw new Error('Query cache scope is required');
  return <ScopedProvider key={scope}>{children}</ScopedProvider>;
}

export { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
