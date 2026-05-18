/**
 * Tweet Skills Module
 *
 * Structural constants used by tweet-craft.service.ts for building
 * system prompts. All text content (brand voice, copywriting frameworks,
 * psychology techniques, humanizer rules, engagement tactics, etc.) has
 * been moved to the database via seed-admin-settings.sql.
 */

/**
 * Twitter/X character count rules.
 * URLs are wrapped by t.co and always count as exactly 23 characters
 * regardless of the original URL length (even very long slug-based URLs).
 */
export const TWEET_CHARACTER_RULES = {
  /** 280 for standard accounts, 25000 for X Premium */
  maxTotalCharacters: 280,
  /**
   * Safe budget for text content when one URL is included.
   * 280 - 23 (t.co URL) - 2 (space before URL / newline) - 5 (safety buffer) = 250.
   * The 5-char buffer prevents edge cases where the AI miscounts by a few chars.
   */
  safeContentBudget: 250,
  tcoUrlLength: 23,
} as const;
