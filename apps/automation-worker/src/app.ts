import { createServiceApp, type ServiceOptions } from '@ruple/platform-server';

export const service: ServiceOptions = { service: 'automation-worker', defaultPort: 3004 };

// Domain modules are added to this service definition, never to the shared runtime.
export function createApp(options: Omit<ServiceOptions, 'service' | 'defaultPort'> = {}) {
  return createServiceApp({ ...options, ...service });
}
