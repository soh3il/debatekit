/**
 * Content Pipeline Enums
 *
 * Status and trigger type enums for automated content pipeline runs.
 * Lifecycle: pending -> discovering -> [awaiting_review] -> creating_jobs -> running -> publishing -> tweeting -> completed | failed | cancelled
 */

import { z } from '@hono/zod-openapi';

import type { BadgeVariant } from './ui';
import { BadgeVariants } from './ui';

// ============================================================================
// CONTENT PIPELINE RUN STATUS
// ============================================================================

export const CONTENT_PIPELINE_STATUSES = [
  'pending',
  'discovering',
  'awaiting_review',
  'creating_jobs',
  'running',
  'publishing',
  'tweeting',
  'completed',
  'failed',
  'cancelled',
] as const;

export const ContentPipelineStatusSchema = z.enum(CONTENT_PIPELINE_STATUSES).openapi({
  description: 'Content pipeline run execution status',
  example: 'running',
});

export type ContentPipelineStatus = z.infer<typeof ContentPipelineStatusSchema>;

export const ContentPipelineStatuses = {
  AWAITING_REVIEW: 'awaiting_review' as const,
  CANCELLED: 'cancelled' as const,
  COMPLETED: 'completed' as const,
  CREATING_JOBS: 'creating_jobs' as const,
  DISCOVERING: 'discovering' as const,
  FAILED: 'failed' as const,
  PENDING: 'pending' as const,
  PUBLISHING: 'publishing' as const,
  RUNNING: 'running' as const,
  TWEETING: 'tweeting' as const,
} as const;

export const DEFAULT_CONTENT_PIPELINE_STATUS = ContentPipelineStatuses.PENDING;

/** Statuses indicating the pipeline is actively running */
export const ACTIVE_CONTENT_PIPELINE_STATUSES = new Set<ContentPipelineStatus>([
  ContentPipelineStatuses.PENDING,
  ContentPipelineStatuses.DISCOVERING,
  ContentPipelineStatuses.CREATING_JOBS,
  ContentPipelineStatuses.RUNNING,
  ContentPipelineStatuses.PUBLISHING,
  ContentPipelineStatuses.TWEETING,
]);

// ============================================================================
// CONTENT PIPELINE TRIGGER TYPE
// ============================================================================

export const CONTENT_PIPELINE_TRIGGER_TYPES = ['cron', 'manual'] as const;

export const ContentPipelineTriggerTypeSchema = z.enum(CONTENT_PIPELINE_TRIGGER_TYPES).openapi({
  description: 'How the pipeline run was triggered',
  example: 'cron',
});

export type ContentPipelineTriggerType = z.infer<typeof ContentPipelineTriggerTypeSchema>;

export const ContentPipelineTriggerTypes = {
  CRON: 'cron' as const,
  MANUAL: 'manual' as const,
} as const;

export const DEFAULT_CONTENT_PIPELINE_TRIGGER_TYPE = ContentPipelineTriggerTypes.CRON;

// ============================================================================
// VIRAL SCORE TIER
// ============================================================================

export const VIRAL_SCORE_TIERS = ['low', 'medium', 'high', 'viral'] as const;

export const ViralScoreTierSchema = z.enum(VIRAL_SCORE_TIERS).openapi({
  description: 'Viral potential tier based on score',
  example: 'high',
});

export type ViralScoreTier = z.infer<typeof ViralScoreTierSchema>;

export const ViralScoreTiers = {
  HIGH: 'high' as const,
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  VIRAL: 'viral' as const,
} as const;

export const DEFAULT_VIRAL_SCORE_TIER = ViralScoreTiers.MEDIUM;

/**
 * Get viral score tier from numeric score (0-100)
 */
export function getViralScoreTier(score: number): ViralScoreTier {
  if (score >= 90) {
    return ViralScoreTiers.VIRAL;
  }
  if (score >= 70) {
    return ViralScoreTiers.HIGH;
  }
  if (score >= 40) {
    return ViralScoreTiers.MEDIUM;
  }
  return ViralScoreTiers.LOW;
}

// ============================================================================
// BADGE VARIANT MAPPINGS
// ============================================================================

export const CONTENT_PIPELINE_STATUS_TO_BADGE_VARIANT: Record<ContentPipelineStatus, BadgeVariant> = {
  awaiting_review: BadgeVariants.SECONDARY,
  cancelled: BadgeVariants.DESTRUCTIVE,
  completed: BadgeVariants.SUCCESS,
  creating_jobs: BadgeVariants.DEFAULT,
  discovering: BadgeVariants.DEFAULT,
  failed: BadgeVariants.DESTRUCTIVE,
  pending: BadgeVariants.OUTLINE,
  publishing: BadgeVariants.DEFAULT,
  running: BadgeVariants.DEFAULT,
  tweeting: BadgeVariants.DEFAULT,
};

export function getPipelineStatusBadgeVariant(status: ContentPipelineStatus): BadgeVariant {
  return CONTENT_PIPELINE_STATUS_TO_BADGE_VARIANT[status];
}

export const VIRAL_SCORE_TIER_TO_BADGE_VARIANT: Record<ViralScoreTier, BadgeVariant> = {
  high: BadgeVariants.DEFAULT,
  low: BadgeVariants.OUTLINE,
  medium: BadgeVariants.SECONDARY,
  viral: BadgeVariants.DESTRUCTIVE,
};

export function getViralScoreTierBadgeVariant(tier: ViralScoreTier): BadgeVariant {
  return VIRAL_SCORE_TIER_TO_BADGE_VARIANT[tier];
}
