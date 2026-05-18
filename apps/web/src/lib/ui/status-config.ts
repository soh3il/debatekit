/**
 * Unified Status Config
 *
 * Single source of truth for status → icon/animation/variant mapping
 * across all admin entity types (jobs, tweets, pipeline runs).
 *
 * Replaces: job-status-config.ts (jobs-only), inline getStatusIcon (pipeline)
 */

import type {
  AutomatedJobStatus,
  BadgeVariant,
  ContentPipelineStatus,
  ScheduledTweetStatus,
} from '@debatekit/shared/enums';
import {
  ACTIVE_CONTENT_PIPELINE_STATUSES,
  getJobStatusBadgeVariant,
  getPipelineStatusBadgeVariant,
  getTweetStatusBadgeVariant,
} from '@debatekit/shared/enums';
import type { LucideIcon } from 'lucide-react';

import { Icons } from '@/components/icons';

// ============================================================================
// TYPES
// ============================================================================

export type StatusConfig = {
  icon: LucideIcon;
  isAnimated: boolean;
  variant: BadgeVariant;
};

// ============================================================================
// JOB STATUS
// ============================================================================

const JOB_STATUS_ICONS: Record<AutomatedJobStatus, LucideIcon> = {
  cancelled: Icons.xCircle,
  completed: Icons.checkCircle,
  failed: Icons.alertCircle,
  pending: Icons.clock,
  running: Icons.loader,
};

export function getJobStatusConfig(status: AutomatedJobStatus): StatusConfig {
  return {
    icon: JOB_STATUS_ICONS[status],
    isAnimated: status === 'running',
    variant: getJobStatusBadgeVariant(status),
  };
}

// ============================================================================
// TWEET STATUS
// ============================================================================

const TWEET_STATUS_ICONS: Record<ScheduledTweetStatus, LucideIcon> = {
  cancelled: Icons.xCircle,
  draft: Icons.pencil,
  failed: Icons.alertCircle,
  scheduled: Icons.clock,
  sent: Icons.checkCircle,
};

export function getTweetStatusConfig(status: ScheduledTweetStatus): StatusConfig {
  return {
    icon: TWEET_STATUS_ICONS[status],
    isAnimated: status === 'scheduled',
    variant: getTweetStatusBadgeVariant(status),
  };
}

// ============================================================================
// PIPELINE STATUS
// ============================================================================

const PIPELINE_STATUS_ICONS: Record<ContentPipelineStatus, LucideIcon> = {
  awaiting_review: Icons.eye,
  cancelled: Icons.xCircle,
  completed: Icons.checkCircle,
  creating_jobs: Icons.loader,
  discovering: Icons.loader,
  failed: Icons.alertCircle,
  pending: Icons.clock,
  publishing: Icons.loader,
  running: Icons.loader,
  tweeting: Icons.loader,
};

export function getPipelineStatusConfig(status: ContentPipelineStatus): StatusConfig {
  return {
    icon: PIPELINE_STATUS_ICONS[status],
    isAnimated: ACTIVE_CONTENT_PIPELINE_STATUSES.has(status),
    variant: getPipelineStatusBadgeVariant(status),
  };
}
