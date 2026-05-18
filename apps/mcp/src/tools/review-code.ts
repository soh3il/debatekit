import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_MCP_THINKING_LEVEL } from '@debatekit/shared/enums';

import { debateErrorResult, executeDebate, resolveDebateAuth } from '../lib/debate-tool-runner';
import { DEBATE_ANNOTATIONS } from '../schemas/tool-annotations';
import { ReviewCodeInputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

export function register(server: McpServer, env: Env, ctx: ExecutionContext) {
  server.registerTool(
    'review-code',
    {
      annotations: DEBATE_ANNOTATIONS,
      description: 'Code review council. Senior Engineer, Security Reviewer, and Performance Analyst analyze your code and a moderator synthesizes their findings.',
      inputSchema: ReviewCodeInputSchema,
      title: 'Review Code',
    },
    async (args) => {
      try {
        const { apiKeyHash, ip, userId } = resolveDebateAuth();
        const thinkingLevel = args.thinking_level ?? DEFAULT_MCP_THINKING_LEVEL;

        const langNote = args.language ? ` (${args.language})` : '';
        const focusNote = args.focus?.length ? `\n\nFocus on: ${args.focus.join(', ')}` : '';
        const codePreview = args.code.length > 500
          ? `${args.code.slice(0, 500)}\n... (${args.code.length} chars total)`
          : args.code;
        const prompt = `Review this code${langNote}:${focusNote}\n\n\`\`\`${args.language ?? ''}\n${codePreview}\n\`\`\``;

        return await executeDebate(server, env, ctx, 'review-code', JSON.stringify(args), userId, apiKeyHash, ip, {
          context: args.code,
          format: 'comparison',
          mode: 'analyzing',
          prompt,
          roles: ['Senior Engineer', 'Security Reviewer', 'Performance Analyst'],
          thinkingLevel,
          webhookUrl: args.webhook_url,
        });
      } catch (e) {
        return debateErrorResult(e);
      }
    },
  );
}
