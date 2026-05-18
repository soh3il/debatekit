/**
 * Per-Team KV Storage
 *
 * Stores and retrieves per-workspace tokens and API keys.
 * Supports multi-tenant Slack app distribution where each
 * workspace has its own bot token (from OAuth) and optionally
 * its own DebateKit API key.
 *
 * KV key patterns:
 *   team:{team_id}:bot_token     — Slack bot OAuth token
 *   team:{team_id}:api_key       — DebateKit API key (optional)
 *   team:{team_id}:installed_at  — Installation timestamp
 *   team:{team_id}:installed_by  — User who installed the app
 */

export type TeamInstallation = {
  apiKey?: string;
  botToken: string;
  installedAt: string;
  installedBy: string;
  teamId: string;
  teamName?: string;
};

const PREFIX = 'team';

function key(teamId: string, field: string) {
  return `${PREFIX}:${teamId}:${field}`;
}

/**
 * Save a new team installation (from OAuth callback)
 */
export async function saveInstallation(kv: KVNamespace, install: TeamInstallation) {
  await Promise.all([
    kv.put(key(install.teamId, 'bot_token'), install.botToken),
    kv.put(key(install.teamId, 'installed_at'), install.installedAt),
    kv.put(key(install.teamId, 'installed_by'), install.installedBy),
    ...(install.teamName ? [kv.put(key(install.teamId, 'team_name'), install.teamName)] : []),
  ]);
}

/**
 * Get the bot token for a workspace
 */
export async function getBotToken(kv: KVNamespace, teamId: string) {
  return kv.get(key(teamId, 'bot_token'));
}

/**
 * Get the DebateKit API key for a workspace (if set)
 */
export async function getApiKey(kv: KVNamespace, teamId: string) {
  return kv.get(key(teamId, 'api_key'));
}

/**
 * Save or update the DebateKit API key for a workspace
 */
export async function setApiKey(kv: KVNamespace, teamId: string, apiKey: string) {
  await kv.put(key(teamId, 'api_key'), apiKey);
}

/**
 * Check if a workspace has a DebateKit API key configured
 */
export async function hasApiKey(kv: KVNamespace, teamId: string) {
  const val = await kv.get(key(teamId, 'api_key'));
  return val !== null && val.length > 0;
}

/**
 * Get full installation details for a workspace
 */
export async function getInstallation(kv: KVNamespace, teamId: string): Promise<TeamInstallation | null> {
  const botToken = await getBotToken(kv, teamId);
  if (!botToken) return null;

  const [installedAt, installedBy, teamName, apiKey] = await Promise.all([
    kv.get(key(teamId, 'installed_at')),
    kv.get(key(teamId, 'installed_by')),
    kv.get(key(teamId, 'team_name')),
    kv.get(key(teamId, 'api_key')),
  ]);

  return {
    apiKey: apiKey ?? undefined,
    botToken,
    installedAt: installedAt ?? new Date().toISOString(),
    installedBy: installedBy ?? 'unknown',
    teamId,
    teamName: teamName ?? undefined,
  };
}
