import { defineConfig } from 'drizzle-kit';

const url = process.env.CONTEXT_MIGRATION_URL;
if (!url) throw new Error('Use the local development database command to supply migration settings');
export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/context/server/src/db/schema.ts',
  out: './packages/context/server/db/migrations',
  dbCredentials: { url },
});
