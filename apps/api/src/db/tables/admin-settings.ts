import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Admin Settings
 * Key-value store for configurable admin/pipeline settings.
 * Each row is a single setting with a unique key.
 */
export const adminSettings = sqliteTable('admin_settings', {
  key: text('key').primaryKey(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  value: text('value').notNull(),
});
