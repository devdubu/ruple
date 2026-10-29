import { createContext, useContext, type ReactNode } from 'react';
import type { createApiClient } from './client';

export type ApiService = 'context' | 'automation' | 'interaction' | 'ai';
export type ApiClients = Record<ApiService, ReturnType<typeof createApiClient>>;
const ApiContext = createContext<ApiClients | null>(null);

export function ApiClientsProvider({ clients, children }: { clients: ApiClients; children: ReactNode }) {
  return <ApiContext value={clients}>{children}</ApiContext>;
}
export function useApiClient(service: ApiService) {
  const clients = useContext(ApiContext);
  if (!clients) throw new Error('API clients provider is required');
  return clients[service];
}
