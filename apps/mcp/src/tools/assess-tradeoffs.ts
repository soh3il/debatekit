import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_MCP_THINKING_LEVEL } from '@debatekit/shared/enums';

import { buildPriorSessionContext } from '../lib/context-helpers';
import { debateErrorResult, executeDebate, resolveDebateAuth } from '../lib/debate-tool-runner';
import { DEBATE_ANNOTATIONS } from '../schemas/tool-annotations';
import { AssessTradeoffsInputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

export function register(server: McpServer, env: Env, ctx: ExecutionContext) {
  server.registerTool(
    'assess-tradeoffs',
    {
      annotations: DEBATE_ANNOTATIONS,
      description: 'Tradeoff assessment council. Pragmatist, Skeptic, and Futurist evaluate options from different angles — short-term vs long-term, risk vs reward, simplicity vs flexibility. Output as pros-cons.',
      inputSchema: AssessTradeoffsInputSchema,
      title: 'Assess Tradeoffs',
    },
    async (args) => {
      try {
        const { apiKeyHash, ip, userId } = resolveDebateAuth();
        const thinkingLevel = args.thinking_level ?? DEFAULT_MCP_THINKING_LEVEL;

        const priorContext = args.session_context?.length
          ? await buildPriorSessionContext(env, userId, args.session_context)
          : '';

        const optionsContext = args.options?.length ? `\n\nOptions to compare: ${args.options.join(', ')}` : '';
        const priorityContext = args.priorities?.length ? `\n\nPriorities: ${args.priorities.join(', ')}` : '';
        const backgroundPreview = args.context
          ? `\n\nBackground: ${args.context.length > 300 ? `${args.context.slice(0, 300)}...` : args.context}`
          : '';
        const prompt = `Assess tradeoffs for: ${args.decision}${optionsContext}${priorityContext}${backgroundPreview}`;
        const combinedContext = priorContext + (args.context ?? '');

        return await executeDebate(server, env, ctx, 'assess-tradeoffs', JSON.stringify(args), userId, apiKeyHash, ip, {
          context: combinedContext || undefined,
          format: 'pros-cons',
          mode: 'analyzing',
          prompt,
          roles: ['Pragmatist', 'Skeptic', 'Futurist'],
          thinkingLevel,
          webhookUrl: args.webhook_url,
        });
      } catch (e) {
        return debateErrorResult(e);
      }
    },
  );
}
