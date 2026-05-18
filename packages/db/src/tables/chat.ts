import {
  CHANGELOG_TYPES,
  CHAT_MODES,
  DEFAULT_CHAT_MODE,
  DEFAULT_MESSAGE_STATUS,
  DEFAULT_PODCAST_STATUS,
  DEFAULT_ROUND_EXECUTION_TABLE_STATUS,
  DEFAULT_THREAD_STATUS,
  MESSAGE_ROLES,
  MESSAGE_STATUSES,
  PODCAST_SCOPES,
  PODCAST_STATUSES,
  ROUND_EXECUTION_TABLE_STATUSES,
  THREAD_STATUSES,
} from '@debatekit/shared/enums';
import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type {
  DbChangelogData,
  DbCustomRoleMetadata,
  DbMessageMetadata,
  DbMessageParts,
  DbModelRoles,
  DbParticipantSettings,
  DbPodcastScript,
  DbPreSearchTableData,
  DbThreadMetadata,
  DbToolCalls,
  DbUserPresetMetadata,
} from '../schemas/chat-metadata';
import { user } from './auth';

// Forward declaration for project FK — defined in API-only tables
// Use a lazy reference to avoid circular dependency with project table
// If project table is not available, this FK won't be enforced at the Drizzle level
// but the SQL migration already has the constraint

export const chatThread = sqliteTable('chat_thread', {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .notNull(),
  enablePodcast: integer('enable_podcast', { mode: 'boolean' })
    .notNull()
    .default(false),
  enableWebSearch: integer('enable_web_search', { mode: 'boolean' })
    .notNull()
    .default(false),

  id: text('id').primaryKey(),

  isAiGeneratedTitle: integer('is_ai_generated_title', { mode: 'boolean' })
    .notNull()
    .default(false),
  isFavorite: integer('is_favorite', { mode: 'boolean' })
    .notNull()
    .default(false),
  isPublic: integer('is_public', { mode: 'boolean' })
    .notNull()
    .default(false),
  lastMessageAt: integer('last_message_at', { mode: 'timestamp_ms' }),
  metadata: text('metadata', { mode: 'json' }).$type<DbThreadMetadata>(),
  mode: text('mode', { enum: CHAT_MODES })
    .notNull()
    .default(DEFAULT_CHAT_MODE),
  previousSlug: text('previous_slug'),
  projectId: text('project_id'),
  slug: text('slug').notNull().unique(),
  status: text('status', { enum: THREAD_STATUSES })
    .notNull()
    .default(DEFAULT_THREAD_STATUS),
  title: text('title').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
}, table => [
  index('chat_thread_user_idx').on(table.userId),
  index('chat_thread_project_idx').on(table.projectId),
  index('chat_thread_status_idx').on(table.status),
  index('chat_thread_updated_idx').on(table.updatedAt),
  index('chat_thread_slug_idx').on(table.slug),
  index('chat_thread_previous_slug_idx').on(table.previousSlug),
  index('chat_thread_favorite_idx').on(table.isFavorite),
  index('chat_thread_public_idx').on(table.isPublic),
  index('chat_thread_public_status_idx').on(table.isPublic, table.status),
]);

export const chatCustomRole = sqliteTable('chat_custom_role', {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .notNull(),
  description: text('description'),
  id: text('id').primaryKey(),
  metadata: text('metadata', { mode: 'json' }).$type<DbCustomRoleMetadata>(),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
}, table => [
  index('chat_custom_role_user_idx').on(table.userId),
  index('chat_custom_role_name_idx').on(table.name),
]);

export const chatUserPreset = sqliteTable('chat_user_preset', {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .notNull(),
  id: text('id').primaryKey(),
  metadata: text('metadata', { mode: 'json' }).$type<DbUserPresetMetadata>(),
  mode: text('mode', { enum: CHAT_MODES })
    .notNull()
    .default(DEFAULT_CHAT_MODE),
  modelRoles: text('model_roles', { mode: 'json' }).$type<DbModelRoles>().notNull(),
  name: text('name').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
}, table => [
  index('chat_user_preset_user_idx').on(table.userId),
  index('chat_user_preset_name_idx').on(table.name),
]);

export const chatParticipant = sqliteTable('chat_participant', {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .notNull(),
  customRoleId: text('custom_role_id')
    .references(() => chatCustomRole.id, { onDelete: 'set null' }),
  id: text('id').primaryKey(),
  isEnabled: integer('is_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  modelId: text('model_id').notNull(),
  priority: integer('priority').notNull().default(0),
  role: text('role'),
  settings: text('settings', { mode: 'json' }).$type<DbParticipantSettings>(),
  threadId: text('thread_id')
    .notNull()
    .references(() => chatThread.id, { onDelete: 'cascade' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, table => [
  index('chat_participant_thread_idx').on(table.threadId),
  index('chat_participant_priority_idx').on(table.priority),
  index('chat_participant_custom_role_idx').on(table.customRoleId),
  check('check_priority_non_negative', sql`${table.priority} >= 0`),
  uniqueIndex('chat_participant_thread_model_unique').on(table.threadId, table.modelId),
]);

export const chatThreadChangelog = sqliteTable('chat_thread_changelog', {
  changeData: text('change_data', { mode: 'json' }).$type<DbChangelogData>().notNull(),
  changeSummary: text('change_summary').notNull(),
  changeType: text('change_type', { enum: CHANGELOG_TYPES }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .notNull(),
  id: text('id').primaryKey(),
  roundNumber: integer('round_number')
    .notNull()
    .default(0),
  threadId: text('thread_id')
    .notNull()
    .references(() => chatThread.id, { onDelete: 'cascade' }),
}, table => [
  index('chat_thread_changelog_thread_idx').on(table.threadId),
  index('chat_thread_changelog_type_idx').on(table.changeType),
  index('chat_thread_changelog_created_idx').on(table.createdAt),
  index('chat_thread_changelog_thread_round_idx').on(table.threadId, table.roundNumber),
]);

export const chatMessage = sqliteTable('chat_message', {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .notNull(),
  id: text('id').primaryKey(),
  metadata: text('metadata', { mode: 'json' }).$type<DbMessageMetadata>(),
  participantId: text('participant_id')
    .references(() => chatParticipant.id, { onDelete: 'set null' }),
  parts: text('parts', { mode: 'json' }).notNull().$type<DbMessageParts>(),
  role: text('role', { enum: MESSAGE_ROLES })
    .notNull()
    .default('assistant'),
  roundNumber: integer('round_number')
    .notNull()
    .default(0),
  threadId: text('thread_id')
    .notNull()
    .references(() => chatThread.id, { onDelete: 'cascade' }),
  toolCalls: text('tool_calls', { mode: 'json' }).$type<DbToolCalls>(),
}, table => [
  index('chat_message_thread_idx').on(table.threadId),
  index('chat_message_created_idx').on(table.createdAt),
  index('chat_message_participant_idx').on(table.participantId),
  index('chat_message_role_idx').on(table.role),
  index('chat_message_thread_created_idx').on(table.threadId, table.createdAt),
  index('chat_message_thread_round_idx').on(table.threadId, table.roundNumber),
]);

export const chatPreSearch = sqliteTable('chat_pre_search', {
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .notNull(),
  errorMessage: text('error_message'),
  id: text('id').primaryKey(),
  roundNumber: integer('round_number').notNull(),
  searchData: text('search_data', { mode: 'json' }).$type<DbPreSearchTableData>(),
  status: text('status', { enum: MESSAGE_STATUSES })
    .notNull()
    .default(DEFAULT_MESSAGE_STATUS),
  threadId: text('thread_id')
    .notNull()
    .references(() => chatThread.id, { onDelete: 'cascade' }),
  userQuery: text('user_query').notNull(),
}, table => [
  index('chat_pre_search_thread_idx').on(table.threadId),
  index('chat_pre_search_round_idx').on(table.threadId, table.roundNumber),
  index('chat_pre_search_created_idx').on(table.createdAt),
  index('chat_pre_search_status_idx').on(table.status),
  uniqueIndex('chat_pre_search_thread_round_unique').on(table.threadId, table.roundNumber),
]);

export const roundExecution = sqliteTable('round_execution', {
  attempts: integer('attempts').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .notNull(),
  errorMessage: text('error_message'),
  id: text('id').primaryKey(),
  lastAttemptAt: integer('last_attempt_at', { mode: 'timestamp_ms' }),
  moderatorCompletedAt: integer('moderator_completed_at', { mode: 'timestamp_ms' }),
  participantsCompleted: integer('participants_completed').notNull().default(0),
  participantsTotal: integer('participants_total').notNull().default(0),
  preSearchCompletedAt: integer('pre_search_completed_at', { mode: 'timestamp_ms' }),
  roundNumber: integer('round_number').notNull().default(0),
  status: text('status', { enum: ROUND_EXECUTION_TABLE_STATUSES })
    .notNull()
    .default(DEFAULT_ROUND_EXECUTION_TABLE_STATUS),
  threadId: text('thread_id')
    .notNull()
    .references(() => chatThread.id, { onDelete: 'cascade' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
}, table => [
  uniqueIndex('round_execution_thread_round_unique').on(table.threadId, table.roundNumber),
  index('round_execution_status_idx').on(table.status),
  index('round_execution_thread_idx').on(table.threadId),
  index('round_execution_user_idx').on(table.userId),
  index('round_execution_recovery_idx').on(table.status, table.lastAttemptAt),
]);

export const chatPodcast = sqliteTable('chat_podcast', {
  audioDurationMs: integer('audio_duration_ms'),
  audioR2Key: text('audio_r2_key'),
  audioSizeBytes: integer('audio_size_bytes'),
  characterCount: integer('character_count'),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .notNull(),
  creditsUsed: integer('credits_used'),
  episodeNumber: integer('episode_number'),
  episodeTitle: text('episode_title'),
  errorMessage: text('error_message'),
  id: text('id').primaryKey(),
  progress: integer('progress').notNull().default(0),
  roundNumber: integer('round_number'),
  scope: text('scope', { enum: PODCAST_SCOPES }).notNull(),
  scriptData: text('script_data', { mode: 'json' }).$type<DbPodcastScript>(),
  status: text('status', { enum: PODCAST_STATUSES })
    .notNull()
    .default(DEFAULT_PODCAST_STATUS),
  threadId: text('thread_id')
    .notNull()
    .references(() => chatThread.id, { onDelete: 'cascade' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
}, table => [
  index('chat_podcast_thread_idx').on(table.threadId),
  index('chat_podcast_user_idx').on(table.userId),
  index('chat_podcast_status_idx').on(table.status),
  uniqueIndex('chat_podcast_thread_scope_round_unique').on(table.threadId, table.scope, table.roundNumber),
]);
