import type { ReactNode } from 'react';
import { ApiClientsProvider, AppQueryProvider, type ApiClients } from '@ruple/platform-client';
import { DeviceProvider, type DeviceProfile } from '@ruple/presentation';

export function AppProviders({ device, cacheScope, children, clients }: {
  device: DeviceProfile; cacheScope: string; children: ReactNode; clients: ApiClients;
}) {
  return <AppQueryProvider scope={cacheScope}><ApiClientsProvider clients={clients}>
    <DeviceProvider device={device}>{children}</DeviceProvider>
  </ApiClientsProvider></AppQueryProvider>;
}
