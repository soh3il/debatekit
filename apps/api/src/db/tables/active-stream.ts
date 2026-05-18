/**
 * Active Stream Table
 *
 * Tracks active stream IDs per entity (presearch, participant, moderator)
 * for AI SDK resumable stream support.
 *
 * Per AI SDK docs: "Storage to track which stream belongs to each chat"
 * Extended for multi-entity: one activeStreamId per entity type per round.
 */

import { chatThread } from '@debatekit/db/tables';
import { DEFAULT_ENTITY_PHASE, ENTITY_PHASES } from '@debatekit/shared/enums';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Active Stream Table
 * Stores the active stream ID for each entity during streaming.
 * Used by resumable-stream library to enable stream resumption.
 */
export const activeStream = sqliteTable('active_stream', {
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  // Entity index: null for presearch/moderator, 0-N for participants
  entityIndex: integer('entity_index'),
  // Entity type: presearch, participant, or moderator
  entityType: text('entity_type', { enum: ENTITY_PHASES })
    .notNull()
    .default(DEFAULT_ENTITY_PHASE),
  id: text('id').primaryKey(),
  roundNumber: integer('round_number').notNull(),
  // The stream ID for resumable-stream library
  streamId: text('stream_id').notNull(),
  threadId: text('thread_id')
    .notNull()
    .references(() => chatThread.id, { onDelete: 'cascade' }),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
}, table => [
  index('idx_active_stream_thread').on(table.threadId),
  // Unique constraint: one stream per entity per round
  uniqueIndex('idx_active_stream_lookup').on(
    table.threadId,
    table.roundNumber,
    table.entityType,
    table.entityIndex,
  ),
]);
