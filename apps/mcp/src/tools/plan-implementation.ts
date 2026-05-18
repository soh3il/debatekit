import { DEFAULT_MCP_THINKING_LEVEL } from '@debatekit/shared/enums';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { buildKnowledgeContext, buildPriorSessionContext } from '../lib/context-helpers';
import { debateErrorResult, executeDebate, resolveDebateAuth } from '../lib/debate-tool-runner';
import { DEBATE_ANNOTATIONS } from '../schemas/tool-annotations';
import { PlanImplementationInputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

export function register(server: McpServer, env: Env, ctx: ExecutionContext) {
  server.registerTool(
    'plan-implementation',
    {
      annotations: DEBATE_ANNOTATIONS,
      description: 'Implementation planning council. Tech Lead, Senior Engineer, and QA Strategist break down a feature into actionable steps, identify risks, and define acceptance criteria. Output as ADR.',
      inputSchema: PlanImplementationInputSchema,
      title: 'Plan Implementation',
    },
    async (args) => {
      try {
        const { apiKeyHash, ip, userId } = resolveDebateAuth();
        const thinkingLevel = args.thinking_level ?? DEFAULT_MCP_THINKING_LEVEL;

        const priorContext = args.session_context?.length
          ? await buildPriorSessionContext(env, userId, args.session_context)
          : '';

        const knowledgeContext = args.knowledge?.length
          ? await buildKnowledgeContext(args.knowledge)
          : '';

        const stackContext = args.tech_stack?.length ? `\n\nTech stack: ${args.tech_stack.join(', ')}` : '';
        const constraintContext = args.constraints?.length ? `\n\nConstraints: ${args.constraints.join(', ')}` : '';
        const codebasePreview = args.codebase_context
          ? `\n\nCodebase context: ${args.codebase_context.length > 300 ? `${args.codebase_context.slice(0, 300)}...` : args.codebase_context}`
          : '';
        const prompt = `Plan the implementation for: ${args.feature}${stackContext}${constraintContext}${codebasePreview}`;
        const combinedCodebaseContext = knowledgeContext + priorContext + (args.codebase_context ?? '');

        return await executeDebate(server, env, ctx, 'plan-implementation', JSON.stringify(args), userId, apiKeyHash, ip, {
          context: combinedCodebaseContext || undefined,
          format: 'adr',
          mode: 'solving',
          prompt,
          roles: ['Tech Lead', 'Senior Engineer', 'QA Strategist'],
          thinkingLevel,
          webhookUrl: args.webhook_url,
        });
      } catch (e) {
        return debateErrorResult(e);
      }
    },
  );
}
