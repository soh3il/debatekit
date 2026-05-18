/**
 * Web Constants Index
 *
 * Re-exports shared constants from @debatekit/shared.
 * Platform-specific constants (version, brand, animations, analytics, system) are defined locally.
 */

// Shared constants from @debatekit/shared
export type { Limits, ProjectLimits } from '@debatekit/shared';
export { API, LIMITS, PROJECT_LIMITS } from '@debatekit/shared';
export {
  DISPOSABLE_EMAIL_DOMAINS,
  EMAIL_EXPIRATION_TIMES,
  EMAIL_REGEX,
  EMAIL_SERVICE_CONFIG,
  FREE_EMAIL_PROVIDERS,
  MAX_EMAIL_LENGTH,
  MAX_EMAIL_LOCAL_LENGTH,
  PROBLEMATIC_EMAIL_CHARS,
} from '@debatekit/shared';

// Platform-specific exports
export * from './analytics';
export * from './animations';
export * from './brand';
export * from './system';
export * from './version';
