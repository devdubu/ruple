import { createApiClient } from '@ruple/platform-client';

// Development proxy defaults; deployment routing is configured explicitly later.
export function createConfiguredClients() {
  return {
    context: createApiClient({ baseUrl: import.meta.env.VITE_CONTEXT_API_URL ?? '/services/context' }),
    automation: createApiClient({ baseUrl: import.meta.env.VITE_AUTOMATION_API_URL ?? '/services/automation' }),
    interaction: createApiClient({ baseUrl: import.meta.env.VITE_INTERACTION_API_URL ?? '/services/interaction' }),
    ai: createApiClient({ baseUrl: import.meta.env.VITE_AI_API_URL ?? '/services/ai' }),
  };
}
