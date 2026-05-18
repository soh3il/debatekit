/**
 * Shared constants for DebateKit integrations.
 */

/** Default timeout for API requests (2 minutes) */
export const API_TIMEOUT_MS = 120_000

/** API version prefix */
export const API_VERSION = 'v1'

/** Header name for API key authentication */
export const API_KEY_HEADER = 'x-api-key'

/** Header name for integration source identification */
export const SOURCE_HEADER = 'x-debatekit-source'

/** API key prefix for validation */
export const API_KEY_PREFIX = 'rpnd_'

/** Default MCP REST API base URL */
export const DEBATEKIT_DEFAULT_URL = 'https://mcp.debatekit.ai'

/** DebateKit web app URL */
export const DEBATEKIT_APP_URL = 'https://debatekit.ai'

/** Path to API key settings page */
export const API_KEY_SETTINGS_PATH = '/chat/settings/api-keys'

/** Full URL to the API key settings page */
export const API_KEY_SETTINGS_URL = `${DEBATEKIT_APP_URL}${API_KEY_SETTINGS_PATH}`

/** Build a dashboard thread URL from a thread slug */
export function getThreadDashboardUrl(appUrl: string, threadSlug: string) {
  return `${appUrl}/chat/${threadSlug}`
}

/** Build a public thread URL from a thread slug */
export function getThreadPublicUrl(appUrl: string, threadSlug: string) {
  return `${appUrl}/public/chat/${threadSlug}`
}
