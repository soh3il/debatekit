import { chatThread, user } from '@debatekit/db/tables';
import { SCHEDULED_TWEET_STATUSES, TWEET_SOURCES } from '@debatekit/shared/enums';
import { relations, sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { DbScheduledTweetMetadata } from '@/db/schemas/tweet-metadata';

import { automatedJob } from './job';
import { contentPipelineRun } from './pipeline';

/**
 * Scheduled Tweets
 * Tweets created manually or by automated jobs, tracked through draft -> scheduled -> sent lifecycle
 */
export const scheduledTweet = sqliteTable('scheduled_tweet', {
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  id: text('id').primaryKey(),
  jobId: text('job_id')
    .references(() => automatedJob.id, { onDelete: 'set null' }),
  metadata: text('metadata', { mode: 'json' }).$type<DbScheduledTweetMetadata>(),
  pipelineRunId: text('pipeline_run_id')
    .references(() => contentPipelineRun.id, { onDelete: 'set null' }),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }),
  sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
  source: text('source', { enum: TWEET_SOURCES }).notNull().default('manual'),
  status: text('status', { enum: SCHEDULED_TWEET_STATUSES }).notNull().default('draft'),
  threadId: text('thread_id')
    .references(() => chatThread.id, { onDelete: 'set null' }),
  twitterPostId: text('twitter_post_id'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  viralScore: integer('viral_score'),
}, table => [
  index('scheduled_tweet_user_idx').on(table.userId),
  index('scheduled_tweet_status_idx').on(table.status),
  index('scheduled_tweet_scheduled_at_idx').on(table.scheduledAt),
  index('scheduled_tweet_job_idx').on(table.jobId),
  index('scheduled_tweet_pipeline_idx').on(table.pipelineRunId),
  index('scheduled_tweet_thread_idx').on(table.threadId),
]);

/**
 * Scheduled Tweet Relations
 */
export const scheduledTweetRelations = relations(scheduledTweet, ({ one }) => ({
  job: one(automatedJob, {
    fields: [scheduledTweet.jobId],
    references: [automatedJob.id],
  }),
  pipelineRun: one(contentPipelineRun, {
    fields: [scheduledTweet.pipelineRunId],
    references: [contentPipelineRun.id],
  }),
  thread: one(chatThread, {
    fields: [scheduledTweet.threadId],
    references: [chatThread.id],
  }),
  user: one(user, {
    fields: [scheduledTweet.userId],
    references: [user.id],
  }),
}));
