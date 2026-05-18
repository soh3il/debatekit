import { CONTENT_PIPELINE_STATUSES, CONTENT_PIPELINE_TRIGGER_TYPES } from '@debatekit/shared/enums';
import { relations, sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { DbContentPipelineMetadata, DbPipelineDiscoveredTopic, DbPipelineSelectedTopic, DbViralScoreMap } from '@/db/schemas/pipeline-metadata';

/**
 * Content Pipeline Runs
 * Automated content discovery, job creation, and tweet publishing pipeline
 */
export const contentPipelineRun = sqliteTable('content_pipeline_run', {
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  createdJobIds: text('created_job_ids', { mode: 'json' }).$type<string[]>(),
  createdTweetIds: text('created_tweet_ids', { mode: 'json' }).$type<string[]>(),
  discoveredTopics: text('discovered_topics', { mode: 'json' }).$type<DbPipelineDiscoveredTopic[]>(),
  errorMessage: text('error_message'),
  id: text('id').primaryKey(),
  metadata: text('metadata', { mode: 'json' }).$type<DbContentPipelineMetadata>(),
  selectedTopics: text('selected_topics', { mode: 'json' }).$type<DbPipelineSelectedTopic[]>(),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }),
  status: text('status', { enum: CONTENT_PIPELINE_STATUSES })
    .notNull()
    .default('pending'),
  triggerType: text('trigger_type', { enum: CONTENT_PIPELINE_TRIGGER_TYPES })
    .notNull()
    .default('cron'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date())
    .notNull(),
  viralScores: text('viral_scores', { mode: 'json' }).$type<DbViralScoreMap>(),
}, table => [
  index('content_pipeline_run_status_idx').on(table.status),
  index('content_pipeline_run_trigger_type_idx').on(table.triggerType),
  index('content_pipeline_run_created_idx').on(table.createdAt),
]);

/**
 * Content Pipeline Run Relations
 * Jobs and tweets are tracked by ID arrays, no direct foreign key relations needed
 */
export const contentPipelineRunRelations = relations(contentPipelineRun, () => ({}));
