/**
 * Shared Debate Tool Runner
 *
 * Extracts the common execution pattern shared by all debate-style MCP tools:
 * auth → preset → withCredits(runDebate) → webhook → format → content.
 *
 * Each tool calls registerTool directly (preserving SDK type safety) and
 * delegates the shared pipeline to `executeDebate`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ChatMode, McpOutputFormat, McpThinkingLevel } from '@debatekit/shared/enums';
import { getMcpAuthContext } from 'agents/mcp';

import { runDebate } from '../engine/debate-engine';
import { formatDebateAsMarkdown } from '../engine/format-markdown';
import { THINKING_PRESETS } from '../engine/presets';
import { withCredits } from '../engine/with-credits';
import type { Env } from '../types';
import { getAuthProps } from './auth-context';
import { buildDebateContentWithStructured } from './content-builder';
import { createProgressNotifier } from './progress';
import { getThreadUrl } from './url-resolver';

export type DebateParams = {
  /** Optional context string for the debate */
  context?: string;
  /** Output format for the moderator */
  format: McpOutputFormat;
  /** Conversation mode */
  mode: ChatMode;
  /** Model IDs to use (overrides preset defaults) */
  modelIds?: string[];
  /** The resolved prompt to send to the debate */
  prompt: string;
  /** Participant roles */
  roles?: string[];
  /** Thinking level for preset resolution */
  thinkingLevel: McpThinkingLevel;
  /** Optional webhook URL to POST results to */
  webhookUrl?: string;
};

/**
 * Shared auth resolution for debate tools.
 * Returns userId plus fields needed by withCredits.
 */
export function resolveDebateAuth() {
  const auth = getMcpAuthContext();
  return getAuthProps(auth);
}

/**
 * Executes the shared debate pipeline: credits, debate, webhook, format.
 *
 * Called from each tool's registerTool callback after resolving tool-specific
 * params. Tools register themselves directly (preserving SDK type safety)
 * and delegate execution here.
 */
export async function executeDebate(
  server: McpServer,
  env: Env,
  ctx: ExecutionContext,
  toolName: string,
  inputJson: string,
  userId: string,
  apiKeyHash: string | undefined,
  ip: string | undefined,
  params: DebateParams,
): Promise<CallToolResult> {
  const { thinkingLevel } = params;
  const preset = THINKING_PRESETS[thinkingLevel];
  const onProgress = createProgressNotifier(server);

  const modelIds = params.modelIds ?? preset.defaultModels;

  const { result, sessionId, threadSlug } = await withCredits(env, userId, {
    apiKeyHash,
    context: params.context,
    ctx,
    inputJson,
    ip,
    modelIds,
    moderatorModelId: preset.moderatorModel,
    participantCount: modelIds.length,
    prompt: params.prompt,
    thinkingLevel,
    toolName,
  }, () =>
    runDebate({
      context: params.context,
      format: params.format,
      mode: params.mode,
      onProgress,
      prompt: params.prompt,
      roles: params.roles,
      thinkingLevel,
      toolName,
      userId,
    }, env));

  if (params.webhookUrl) {
    const { sendWebhook } = await import('../engine/webhooks');
    sendWebhook(ctx, params.webhookUrl, {
      metadata: result.metadata,
      moderator_summary: result.moderator.summary,
      tool_name: toolName,
    });
  }

  const threadUrl = threadSlug ? getThreadUrl(env, threadSlug) : undefined;
  const markdown = formatDebateAsMarkdown(result, toolName, params.prompt, { env, sessionId, threadSlug });

  return buildDebateContentWithStructured(markdown, sessionId, threadSlug, threadUrl, result);
}

/** Standard error response for debate tool failures */
export function debateErrorResult(e: unknown): CallToolResult {
  const message = e instanceof Error ? e.message : 'An unexpected error occurred';
  return {
    content: [{ text: `Error: ${message}`, type: 'text' }],
    isError: true,
  };
}
