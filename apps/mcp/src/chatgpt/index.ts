/**
 * ChatGPT App Directory Registration
 *
 * Registers the DebateKit debate results viewer as an MCP App resource
 * using the @modelcontextprotocol/ext-apps server helpers.
 *
 * Tools are NOT re-registered here -- existing tools already work via
 * standard MCP. This module only registers the UI widget resource
 * so ChatGPT can render rich debate results.
 */

import { getAppUrl } from '@debatekit/shared';
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Env } from '../types';
import { getWidgetHtml } from './widget';

const WIDGET_URI = 'ui://debatekit/debate-results.html';

/**
 * Derives a stable app domain from the web app URL for the current environment.
 * Used as the dedicated sandbox origin for CORS/OAuth purposes.
 */
function getAppDomain(env: Env) {
  return new URL(getAppUrl(env.WEBAPP_ENV)).hostname;
}

export function registerChatGPTApp(server: McpServer, env: Env) {
  registerAppResource(
    server,
    'DebateKit Widget',
    WIDGET_URI,
    { description: 'DebateKit debate results viewer' },
    async () => ({
      contents: [{
        _meta: {
          ui: {
            domain: getAppDomain(env),
            prefersBorder: true,
          },
        },
        mimeType: RESOURCE_MIME_TYPE,
        text: getWidgetHtml(),
        uri: WIDGET_URI,
      }],
    }),
  );
}
