/**
 * Working Memory Table - AI-Maintained Persistent Scratchpad
 *
 * Stores user preferences, learned facts, and conversational context
 * that the AI maintains across sessions via the `updateWorkingMemory` tool.
 *
 * Two scopes:
 * - 'user': Cross-conversation memory (preferences, facts about the user)
 * - 'chat': Per-thread memory (conversation-specific context)
 *
 * Compatible with @ai-sdk-tools/memory DrizzleProvider schema.
 * NOTE: Uses `mode: 'timestamp'` (seconds) instead of `timestamp_ms` because
 * the DrizzleProvider writes Unix seconds internally.
 */

import { user } from '@debatekit/db/tables';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workingMemory = sqliteTable('working_memory', {
  chatId: text('chat_id'), // threadId when scope='chat'

  content: text('content').notNull(),

  id: text('id').primaryKey(),

  scope: text('scope', { enum: ['chat', 'user'] }).notNull(),

  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),

  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
}, table => [
  index('working_memory_scope_idx').on(table.scope),
  index('working_memory_user_idx').on(table.userId),
  index('working_memory_chat_idx').on(table.chatId),
  index('working_memory_chat_scope_idx').on(table.chatId, table.scope),
]);
