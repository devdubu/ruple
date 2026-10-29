import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface DatabaseResource<TSchema extends Record<string, unknown>> {
  db: NodePgDatabase<TSchema>;
  pool: Pool;
  ready(): Promise<boolean>;
  close(): Promise<void>;
}

export function openDatabase<TSchema extends Record<string, unknown>>(
  connectionString: string, schema: TSchema, expectedDatabase: string,
): DatabaseResource<TSchema> {
  let url: URL;
  try { url = new URL(connectionString); }
  catch { throw new Error('Invalid database configuration'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || decodeURIComponent(url.pathname.slice(1)) !== expectedDatabase) {
    throw new Error('Database does not match the owning service');
  }
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 3000, idleTimeoutMillis: 1000 });
  // Idle connection errors must not crash the service; the next probe rechecks availability.
  pool.on('error', () => {});
  return {
    db: drizzle(pool, { schema }),
    pool,
    async ready() {
      try { await pool.query('SELECT 1'); return true; } catch { return false; }
    },
    close: () => pool.end(),
  };
}
