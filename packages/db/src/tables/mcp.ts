import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { user } from './auth';
import { chatThread } from './chat';

export const mcpSession = sqliteTable('mcp_session', {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  durationMs: integer('duration_ms').notNull(),
  evaluationStatus: text('evaluation_status', { enum: ['pending', 'completed', 'failed'] }).notNull().default('pending'),
  executionMode: text('execution_mode', { enum: ['sequential', 'parallel'] }).notNull().default('sequential'),
  format: text('format').notNull(),
  id: text('id').primaryKey(),
  inputJson: text('input_json').notNull(),
  mode: text('mode').notNull(),
  modelIdsJson: text('model_ids_json').notNull(),
  prompt: text('prompt').notNull(),
  promptVersion: integer('prompt_version'),
  qualityScore: integer('quality_score'),
  resultJson: text('result_json').notNull(),
  thinkingLevel: text('thinking_level').notNull(),
  threadId: text('thread_id').references(() => chatThread.id, { onDelete: 'set null' }),
  toolName: text('tool_name').notNull(),
  totalCredits: integer('total_credits').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, table => [
  index('mcp_session_created_idx').on(table.createdAt),
  index('mcp_session_thread_idx').on(table.threadId),
  index('mcp_session_tool_idx').on(table.toolName),
  index('mcp_session_user_created_idx').on(table.userId, table.createdAt),
  index('mcp_session_user_idx').on(table.userId),
]);

export const mcpPromptTemplate = sqliteTable('mcp_prompt_template', {
  avgQualityScore: integer('avg_quality_score'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  id: text('id').primaryKey(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  templateText: text('template_text').notNull(),
  templateType: text('template_type', { enum: ['participant_system', 'moderator_synthesis', 'evaluator'] }).notNull(),
  toolName: text('tool_name').notNull(),
  usageCount: integer('usage_count').notNull().default(0),
  version: integer('version').notNull().default(1),
}, table => [
  index('mcp_prompt_template_active_idx').on(table.isActive),
  index('mcp_prompt_template_tool_idx').on(table.toolName),
  index('mcp_prompt_template_type_idx').on(table.templateType),
]);

export const mcpLog = sqliteTable('mcp_log', {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  dataJson: text('data_json'),
  event: text('event').notNull(),
  id: text('id').primaryKey(),
  level: text('level', { enum: ['info', 'warn', 'error'] }).notNull().default('info'),
  sessionId: text('session_id').references(() => mcpSession.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, table => [
  index('mcp_log_created_idx').on(table.createdAt),
  index('mcp_log_level_idx').on(table.level),
  index('mcp_log_session_idx').on(table.sessionId),
  index('mcp_log_user_created_idx').on(table.userId, table.createdAt),
  index('mcp_log_user_idx').on(table.userId),
]);
