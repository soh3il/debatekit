/**
 * Podcast Pricing Service
 *
 * Credit estimation for podcast generation based on character count.
 * Includes ~30% moderator overhead for intro/transition/closing lines.
 */

import * as z from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Credits per 1000 characters of podcast dialogue.
 * Calibrated against ElevenLabs pricing tiers.
 */
const CREDITS_PER_1000_CHARS = 50;

/**
 * Moderator overhead multiplier.
 * Moderator adds intros, transitions, and closings (~30% of total).
 */
const MODERATOR_OVERHEAD_MULTIPLIER = 1.3;

/**
 * Average characters per message in a debatekit discussion.
 * Based on analysis of typical participant responses.
 */
const AVG_CHARS_PER_MESSAGE = 400;

/**
 * Minimum credit cost for any podcast generation.
 */
const MIN_PODCAST_CREDITS = 100;

// ============================================================================
// SCHEMAS
// ============================================================================

const _PodcastCreditEstimateSchema = z.object({
  characterCount: z.number().int().nonnegative(),
  credits: z.number().int().nonnegative(),
}).strict();

export type PodcastCreditEstimate = z.infer<typeof _PodcastCreditEstimateSchema>;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Estimate podcast credits from a known character count.
 *
 * @param characterCount - Total characters in dialogue
 * @param includeModeratorOverhead - Apply 1.3x overhead for pre-generation estimates
 *   where moderator lines haven't been generated yet. Pass false when called with
 *   actual script character count (which already includes moderator lines).
 * @returns Estimated credits required
 */
export function estimatePodcastCredits(
  characterCount: number,
  includeModeratorOverhead = true,
): PodcastCreditEstimate {
  const effective = includeModeratorOverhead
    ? Math.ceil(characterCount * MODERATOR_OVERHEAD_MULTIPLIER)
    : characterCount;
  const raw = Math.ceil((effective / 1000) * CREDITS_PER_1000_CHARS);
  const credits = Math.max(raw, MIN_PODCAST_CREDITS);

  return {
    characterCount: effective,
    credits,
  };
}

/**
 * Estimate total character count from message count.
 * Used when exact text is not yet available (pre-generation estimate).
 *
 * @param messageCount - Number of messages in the scope
 * @returns Estimated character count (before moderator overhead)
 */
export function estimateCharactersFromMessages(messageCount: number): number {
  return messageCount * AVG_CHARS_PER_MESSAGE;
}
