/**
 * Shared MCP content builders for tool responses.
 * Eliminates duplication across debate tools.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { RunDebateOutput } from '../schemas/tool-schemas';

/**
 * Builds debate content with structuredContent for ChatGPT App Directory rendering.
 * Includes text + optional resource_link + a structured payload that the widget can display.
 */
export function buildDebateContentWithStructured(
  markdown: string,
  sessionId: string | undefined,
  threadSlug: string | undefined,
  threadUrl: string | undefined,
  debateResult: RunDebateOutput,
): CallToolResult {
  const content: CallToolResult['content'] = [
    { annotations: { audience: ['user'] }, text: markdown, type: 'text' },
  ];

  if (threadSlug && threadUrl && sessionId) {
    content.push({
      description: 'View this session in the DebateKit app',
      name: `session-${sessionId}`,
      title: 'View in DebateKit app',
      type: 'resource_link',
      uri: threadUrl,
    });
  }

  return {
    _meta: {
      structuredContent: {
        metadata: debateResult.metadata,
        moderator: { summary: debateResult.moderator.summary },
        participants: debateResult.participants,
        session_id: sessionId,
        thread_url: threadUrl,
      },
    },
    content,
  };
}
