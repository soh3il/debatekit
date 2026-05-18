/**
 * Conversation Messages Table - Required by @ai-sdk-tools/memory DrizzleProvider
 *
 * Minimal table satisfying the ConversationMessagesTable interface.
 * The DrizzleProvider constructor requires this table reference even though
 * we don't use its saveMessage/getMessages methods (our chatMessage table
 * with parts[], metadata, participant attribution is the real message store).
 *
 * Schema matches library's createSqliteMessagesSchema() output exactly:
 * - id: INTEGER PRIMARY KEY AUTOINCREMENT
 * - chat_id: TEXT NOT NULL
 * - user_id: TEXT
 * - role: TEXT NOT NULL
 * - content: TEXT NOT NULL
 * - timestamp: INTEGER NOT NULL (mode: 'timestamp' = Unix seconds)
 */

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const conversationMessages = sqliteTable('conversation_messages', {
  chatId: text('chat_id').notNull(),

  content: text('content').notNull(),

  id: integer('id').primaryKey({ autoIncrement: true }),

  role: text('role').notNull(),

  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),

  userId: text('user_id'),
}, table => [
  index('conversation_messages_chat_idx').on(table.chatId, table.timestamp),
]);
