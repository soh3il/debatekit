/**
 * Participant Limits Configuration
 *
 * ✅ CLIENT-SAFE: No server-only dependencies
 * ✅ SINGLE SOURCE OF TRUTH: Shared between frontend and backend
 *
 * Defines participant count limits for chat threads.
 */

import type { SubscriptionTier } from '@debatekit/shared/enums';
import { SubscriptionTiers } from '@debatekit/shared/enums';

/**
 * Minimum participants required to send a message in the UI
 * Lowered barrier to allow single-model usage
 */
export const MIN_PARTICIPANTS_TO_SEND = 1;

/**
 * Minimum participants required for backend analyze handler
 * Backend operations require 3+ for multi-perspective analysis
 */
export const MIN_PARTICIPANTS_REQUIRED = 3;

/**
 * Maximum participants allowed per tier (absolute limit)
 * Enforced across all tiers — global cap of 6
 */
export const MAX_PARTICIPANTS_LIMIT = 6;

/**
 * Maximum participants for automated jobs (cost control)
 * Same as MAX_PARTICIPANTS_LIMIT — enforced across all automated flows
 */
export const MAX_JOB_PARTICIPANTS = 6;

/**
 * Example participant counts by subscription tier
 * Used by quick-start suggestions to demonstrate debatekit value
 */
export const EXAMPLE_PARTICIPANT_COUNTS = {
  [SubscriptionTiers.FREE]: 3,
  [SubscriptionTiers.PRO]: 4,
} as const satisfies Record<SubscriptionTier, number>;

export function getExampleParticipantCount(tier: SubscriptionTier): number {
  const count = EXAMPLE_PARTICIPANT_COUNTS[tier];
  return count;
}
