/**
 * Queue Types
 *
 * Consolidated type definitions for Cloudflare Queue messages.
 * SINGLE SOURCE OF TRUTH for queue-related types across all workers.
 *
 * Services using these types:
 * - title-generation-queue.service.ts
 * - title-generation-queue.ts (worker consumer)
 *
 * @see /docs/type-inference-patterns.md for type safety patterns
 */

import {
  CheckRoundCompletionReasonSchema,
  ContentPipelineTriggerTypeSchema,
  EmailCategorySchema,
  EmailSendingMessageTypes,
  EmailTemplateIdSchema,
  RoundOrchestrationMessageTypes,
  TweetPostingMessageTypes,
} from '@debatekit/shared/enums';
import { z } from '@hono/zod-openapi';

// ============================================================================
// TITLE GENERATION QUEUE
// ============================================================================

/**
 * Title generation queue message schema
 * Sent when a new thread is created to generate an AI title asynchronously.
 *
 * @see src/workers/title-generation-queue.ts - Consumer
 * @see src/api/services/title-generation-queue.service.ts - Producer
 */
export const TitleGenerationQueueMessageSchema = z.object({
  /** First message content for title generation */
  firstMessage: z.string(),
  /** Unique message ID for idempotency */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Thread ID to update */
  threadId: z.string(),
  /** User ID who owns the thread */
  userId: z.string(),
});

export type TitleGenerationQueueMessage = z.infer<typeof TitleGenerationQueueMessageSchema>;

// ============================================================================
// PODCAST GENERATION QUEUE
// ============================================================================

/**
 * Podcast generation queue message schema
 * Sent when a round completes on a thread with enablePodcast=true.
 *
 * @see src/workers/podcast-generation-queue.ts - Consumer
 * @see src/routes/chat/handlers/unified-round-stream.handler.ts - Producer
 */
export const PodcastGenerationQueueMessageSchema = z.object({
  /** Unique message ID for idempotency */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Round number that just completed */
  roundNumber: z.number(),
  /** Thread ID that completed the round */
  threadId: z.string(),
  /** User ID who owns the thread */
  userId: z.string(),
});

export type PodcastGenerationQueueMessage = z.infer<typeof PodcastGenerationQueueMessageSchema>;

// ============================================================================
// ROUND ORCHESTRATION QUEUE
// ============================================================================

/**
 * Trigger participant queue message schema
 * Sent when a participant completes to trigger the next participant.
 *
 * @see src/workers/round-orchestration-queue.ts - Consumer
 * @see src/api/routes/chat/handlers/streaming.handler.ts - Producer
 */
export const TriggerParticipantQueueMessageSchema = z.object({
  /** Optional attachment IDs to pass to next participant */
  attachmentIds: z.array(z.string()).optional(),
  /** Unique message ID for idempotency: trigger-{threadId}-r{round}-p{index} */
  messageId: z.string(),
  /** Index of participant to trigger (0-based) */
  participantIndex: z.number(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Round number */
  roundNumber: z.number(),
  /** User's session token for auth - queue consumer uses this as Cookie header */
  sessionToken: z.string().min(32, 'Session token must be at least 32 characters'),
  /** Thread ID */
  threadId: z.string(),
  /** Message type discriminator */
  type: z.literal(RoundOrchestrationMessageTypes.TRIGGER_PARTICIPANT),
  /** User ID who owns the thread */
  userId: z.string(),
});

export type TriggerParticipantQueueMessage = z.infer<typeof TriggerParticipantQueueMessageSchema>;

/**
 * Trigger moderator queue message schema
 * Sent when all participants complete to trigger moderator analysis.
 *
 * @see src/workers/round-orchestration-queue.ts - Consumer
 * @see src/api/routes/chat/handlers/streaming.handler.ts - Producer
 */
export const TriggerModeratorQueueMessageSchema = z.object({
  /** Unique message ID for idempotency: trigger-{threadId}-r{round}-moderator */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Round number */
  roundNumber: z.number(),
  /** User's session token for auth - queue consumer uses this as Cookie header */
  sessionToken: z.string().min(32, 'Session token must be at least 32 characters'),
  /** Thread ID */
  threadId: z.string(),
  /** Message type discriminator */
  type: z.literal(RoundOrchestrationMessageTypes.TRIGGER_MODERATOR),
  /** User ID who owns the thread */
  userId: z.string(),
});

export type TriggerModeratorQueueMessage = z.infer<typeof TriggerModeratorQueueMessageSchema>;

// ============================================================================
// CHECK ROUND COMPLETION QUEUE
// ============================================================================

/**
 * Check round completion queue message schema
 * Sent to verify and complete stale/incomplete rounds.
 *
 * This message triggers the round orchestration worker to:
 * 1. Check KV and DB for current round state
 * 2. Determine if any participants or moderator need to be triggered
 * 3. Queue appropriate trigger messages to continue the round
 *
 * @see src/workers/round-orchestration-queue.ts - Consumer
 * @see src/api/routes/chat/handlers/stream-resume.handler.ts - Producer (on resume)
 * @see src/api/routes/chat/handlers/streaming.handler.ts - Producer (on error)
 */
export const CheckRoundCompletionQueueMessageSchema = z.object({
  /** Unique message ID for idempotency */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Reason for the check */
  reason: CheckRoundCompletionReasonSchema,
  /** Round number to check */
  roundNumber: z.number(),
  /** User's session token for auth - queue consumer uses this as Cookie header */
  sessionToken: z.string().min(32, 'Session token must be at least 32 characters'),
  /** Thread ID to check */
  threadId: z.string(),
  /** Message type discriminator */
  type: z.literal(RoundOrchestrationMessageTypes.CHECK_ROUND_COMPLETION),
  /** User ID who owns the thread */
  userId: z.string(),
});

export type CheckRoundCompletionQueueMessage = z.infer<typeof CheckRoundCompletionQueueMessageSchema>;

// ============================================================================
// TRIGGER PRE-SEARCH QUEUE
// ============================================================================

/**
 * Trigger pre-search queue message schema
 * Sent to trigger web search before participants (for threads with web search enabled).
 *
 * @see src/workers/round-orchestration-queue.ts - Consumer
 * @see src/api/routes/chat/handlers/stream-resume.handler.ts - Producer (on recovery)
 */
export const TriggerPreSearchQueueMessageSchema = z.object({
  /** Optional attachment IDs */
  attachmentIds: z.array(z.string()).optional(),
  /** Unique message ID for idempotency: trigger-{threadId}-r{round}-presearch */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Round number */
  roundNumber: z.number(),
  /** User's session token for auth - queue consumer uses this as Cookie header */
  sessionToken: z.string().min(32, 'Session token must be at least 32 characters'),
  /** Thread ID */
  threadId: z.string(),
  /** Message type discriminator */
  type: z.literal(RoundOrchestrationMessageTypes.TRIGGER_PRE_SEARCH),
  /** User ID who owns the thread */
  userId: z.string(),
  /** User query for web search */
  userQuery: z.string(),
});

export type TriggerPreSearchQueueMessage = z.infer<typeof TriggerPreSearchQueueMessageSchema>;

// ============================================================================
// AUTOMATED JOB QUEUE MESSAGES
// ============================================================================

/**
 * Start automated job queue message schema
 * Sent when an admin creates a new automated job.
 *
 * @see src/workers/round-orchestration-queue.ts - Consumer
 * @see src/routes/admin/jobs/handler.ts - Producer
 */
export const StartAutomatedJobQueueMessageSchema = z.object({
  /** Job ID to start */
  jobId: z.string(),
  /** Unique message ID for idempotency */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** User's session token for auth */
  sessionToken: z.string().min(32, 'Session token must be at least 32 characters'),
  /** Message type discriminator */
  type: z.literal(RoundOrchestrationMessageTypes.START_AUTOMATED_JOB),
  /** User ID who owns the job */
  userId: z.string(),
});

export type StartAutomatedJobQueueMessage = z.infer<typeof StartAutomatedJobQueueMessageSchema>;

/**
 * Continue automated job queue message schema
 * Sent after a round completes to continue with next round.
 *
 * @see src/workers/round-orchestration-queue.ts - Consumer
 */
export const ContinueAutomatedJobQueueMessageSchema = z.object({
  /** Current round number (0-based) */
  currentRound: z.number(),
  /** Job ID to continue */
  jobId: z.string(),
  /** Unique message ID for idempotency */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** User's session token for auth */
  sessionToken: z.string().min(32, 'Session token must be at least 32 characters'),
  /** Thread ID for the conversation */
  threadId: z.string(),
  /** Message type discriminator */
  type: z.literal(RoundOrchestrationMessageTypes.CONTINUE_AUTOMATED_JOB),
  /** User ID who owns the job */
  userId: z.string(),
});

export type ContinueAutomatedJobQueueMessage = z.infer<typeof ContinueAutomatedJobQueueMessageSchema>;

/**
 * Complete automated job queue message schema
 * Sent when all rounds are done to finalize the job.
 *
 * @see src/workers/round-orchestration-queue.ts - Consumer
 */
export const CompleteAutomatedJobQueueMessageSchema = z.object({
  /** Whether to auto-publish the thread */
  autoPublish: z.boolean(),
  /** Job ID to complete */
  jobId: z.string(),
  /** Unique message ID for idempotency */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Thread ID for the conversation */
  threadId: z.string(),
  /** Message type discriminator */
  type: z.literal(RoundOrchestrationMessageTypes.COMPLETE_AUTOMATED_JOB),
});

export type CompleteAutomatedJobQueueMessage = z.infer<typeof CompleteAutomatedJobQueueMessageSchema>;

// ============================================================================
// CONTENT PIPELINE QUEUE
// ============================================================================

/**
 * Run content pipeline queue message schema
 * Sent when an admin triggers a manual pipeline run.
 *
 * @see src/workers/round-orchestration-queue.ts - Consumer
 * @see src/routes/admin/pipeline/handler.ts - Producer
 */
export const RunContentPipelineQueueMessageSchema = z.object({
  /** Specific topics to research instead of auto-discovering */
  customTopics: z.array(z.string()).optional(),
  /** Maximum number of topics to discover */
  maxTopics: z.number().optional(),
  /** Unique message ID for idempotency */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Pipeline run ID */
  runId: z.string(),
  /** How the pipeline was triggered */
  triggerType: ContentPipelineTriggerTypeSchema,
  /** Message type discriminator */
  type: z.literal(RoundOrchestrationMessageTypes.RUN_CONTENT_PIPELINE),
});

export type RunContentPipelineQueueMessage = z.infer<typeof RunContentPipelineQueueMessageSchema>;

/**
 * Round orchestration queue message union schema
 * Used by queue consumer to route messages to appropriate handlers.
 */
export const RoundOrchestrationQueueMessageSchema = z.discriminatedUnion('type', [
  TriggerParticipantQueueMessageSchema,
  TriggerModeratorQueueMessageSchema,
  CheckRoundCompletionQueueMessageSchema,
  TriggerPreSearchQueueMessageSchema,
  StartAutomatedJobQueueMessageSchema,
  ContinueAutomatedJobQueueMessageSchema,
  CompleteAutomatedJobQueueMessageSchema,
  RunContentPipelineQueueMessageSchema,
]);

export type RoundOrchestrationQueueMessage = z.infer<typeof RoundOrchestrationQueueMessageSchema>;

// ============================================================================
// TWEET POSTING QUEUE
// ============================================================================

/**
 * Post tweet queue message schema
 * Sent to post a scheduled tweet to Twitter.
 *
 * @see src/workers/tweet-posting-queue.ts - Consumer
 * @see src/routes/admin/tweets/handler.ts - Producer
 */
export const PostTweetQueueMessageSchema = z.object({
  /** Unique message ID for idempotency */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Scheduled tweet ID to post */
  tweetId: z.string(),
  /** Message type discriminator */
  type: z.literal(TweetPostingMessageTypes.POST_TWEET),
});

export type PostTweetQueueMessage = z.infer<typeof PostTweetQueueMessageSchema>;

/**
 * Generate tweet queue message schema
 * Sent to generate a tweet from a completed automated job's thread.
 *
 * @see src/workers/tweet-posting-queue.ts - Consumer
 * @see src/services/jobs/job-orchestration.service.ts - Producer
 */
export const GenerateTweetQueueMessageSchema = z.object({
  /** Job ID that completed */
  jobId: z.string(),
  /** Unique message ID for idempotency */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Thread ID for the completed conversation */
  threadId: z.string(),
  /** Message type discriminator */
  type: z.literal(TweetPostingMessageTypes.GENERATE_TWEET),
  /** User ID who owns the job */
  userId: z.string(),
});

export type GenerateTweetQueueMessage = z.infer<typeof GenerateTweetQueueMessageSchema>;

/**
 * Tweet posting queue message union schema
 * Used by queue consumer to route messages to appropriate handlers.
 */
export const TweetPostingQueueMessageSchema = z.discriminatedUnion('type', [
  PostTweetQueueMessageSchema,
  GenerateTweetQueueMessageSchema,
]);

export type TweetPostingQueueMessage = z.infer<typeof TweetPostingQueueMessageSchema>;

// ============================================================================
// EMAIL SENDING QUEUE
// ============================================================================

/**
 * Send individual email queue message schema
 * Sent to deliver a single email via SES.
 */
export const SendEmailQueueMessageSchema = z.object({
  /** Email category for preference checking */
  category: EmailCategorySchema,
  /** Unique message ID for idempotency */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Recipient email address */
  recipientEmail: z.string().email(),
  /** Send log ID for status tracking */
  sendLogId: z.string(),
  /** Email subject line */
  subject: z.string(),
  /** Template ID to render */
  templateId: EmailTemplateIdSchema,
  /** Template variables for rendering */
  templateVars: z.record(z.string(), z.string()).optional(),
  /** Message type discriminator */
  type: z.literal(EmailSendingMessageTypes.SEND_EMAIL),
  /** User ID (optional for system emails) */
  userId: z.string().optional(),
});

export type SendEmailQueueMessage = z.infer<typeof SendEmailQueueMessageSchema>;

/**
 * Trigger campaign queue message schema
 * Sent to query eligible users and enqueue individual emails.
 */
export const TriggerCampaignQueueMessageSchema = z.object({
  /** Campaign type identifier */
  campaignType: z.string(),
  /** Optional cohort query parameters */
  cohortQuery: z.record(z.string(), z.string()).optional(),
  /** Maximum recipients to process */
  maxRecipients: z.number().optional(),
  /** Unique message ID for idempotency */
  messageId: z.string(),
  /** ISO timestamp when message was queued */
  queuedAt: z.string(),
  /** Message type discriminator */
  type: z.literal(EmailSendingMessageTypes.TRIGGER_CAMPAIGN),
});

export type TriggerCampaignQueueMessage = z.infer<typeof TriggerCampaignQueueMessageSchema>;

/**
 * Email sending queue message union schema
 * Used by queue consumer to route messages to appropriate handlers.
 */
export const EmailSendingQueueMessageSchema = z.discriminatedUnion('type', [
  SendEmailQueueMessageSchema,
  TriggerCampaignQueueMessageSchema,
]);

export type EmailSendingQueueMessage = z.infer<typeof EmailSendingQueueMessageSchema>;
