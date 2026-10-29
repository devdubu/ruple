import { pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

// Disposable infrastructure example; not a routine/recommendation/vehicle business model.
const app = pgSchema('app');
export const developmentProbe = app.table('development_probe', {
  id: text('id').primaryKey(),
  value: text('value').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
});
