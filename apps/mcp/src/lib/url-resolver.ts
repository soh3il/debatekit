/**
 * URL Resolver for MCP Worker
 *
 * MCP-specific path builders. Base URL resolution delegated to @debatekit/shared.
 */

import { getAppUrl } from '@debatekit/shared';

import type { Env } from '../types';

export function getThreadUrl(env: Env, slug: string) {
  return `${getAppUrl(env.WEBAPP_ENV)}/chat/${slug}`;
}

export function getPublicThreadUrl(env: Env, slug: string) {
  return `${getAppUrl(env.WEBAPP_ENV)}/public/chat/${slug}`;
}
