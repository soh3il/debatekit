/**
 * Anonymous Guest Trial Configuration
 *
 * Rate limit constants for anonymous sessions via Better Auth anonymous plugin.
 */

export const ANONYMOUS_CONFIG = {
  EMAIL_DOMAIN: 'anonymous.debatekit.local',
  MAX_PER_IP_PER_DAY: 20,
} as const;
