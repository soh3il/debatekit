import type { Bundle, ZObject } from 'zapier-platform-core';
import { API_KEY_SETTINGS_URL } from './shared-constants';
import { SessionsListResponseSchema } from './types';
import { API_BASE } from './constants';

const test = async (z: ZObject, _bundle: Bundle) => {
  const response = await z.request({
    url: `${API_BASE}/api/v1/sessions`,
    params: { limit: 1 },
  });

  if (response.status !== 200) {
    throw new z.errors.Error(
      'Authentication failed. Check your API key.',
      'AuthenticationError',
      response.status
    );
  }

  return SessionsListResponseSchema.parse(response.data);
};

export default {
  type: 'custom' as const,
  test,
  fields: [
    {
      key: 'api_key',
      label: 'DebateKit API Key',
      type: 'string',
      required: true,
      helpText:
        `Find your API key at [debatekit.ai](${API_KEY_SETTINGS_URL}). Keys start with \`rpnd_\`.`,
    },
  ],
  connectionLabel: (_z: ZObject, bundle: Bundle) => {
    const key = bundle.authData.api_key || '';
    const masked = key.length > 8 ? `${key.slice(0, 8)}...${key.slice(-4)}` : '****';
    return `DebateKit (${masked})`;
  },
};
