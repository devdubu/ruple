import { defineConfig } from 'drizzle-kit';

const url = process.env.INTERACTION_MIGRATION_URL;
if (!url) throw new Error('Use the local development database command to supply migration settings');
export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/interaction/server/src/db/schema.ts',
  out: './packages/interaction/server/db/migrations',
  dbCredentials: { url },
});
