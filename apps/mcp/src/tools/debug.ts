import { DEFAULT_MCP_THINKING_LEVEL } from '@debatekit/shared/enums';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { buildKnowledgeContext, buildPriorSessionContext } from '../lib/context-helpers';
import { debateErrorResult, executeDebate, resolveDebateAuth } from '../lib/debate-tool-runner';
import { DEBATE_ANNOTATIONS } from '../schemas/tool-annotations';
import { DebugInputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

export function register(server: McpServer, env: Env, ctx: ExecutionContext) {
  server.registerTool(
    'debug-issue',
    {
      annotations: DEBATE_ANNOTATIONS,
      description: 'Debugging council. Root Cause Analyst, Systems Engineer, and Edge Case Investigator collaboratively diagnose bugs, analyze errors, and propose fixes.',
      inputSchema: DebugInputSchema,
      title: 'Debug Issue',
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

        const errorContext = args.error ? `\n\nError: ${args.error}` : '';
        const expectedContext = args.expected_behavior ? `\n\nExpected behavior: ${args.expected_behavior}` : '';
        const codeContext = knowledgeContext + priorContext + (args.code ?? '');
        const codePreview = args.code
          ? `\n\n\`\`\`\n${args.code.length > 500 ? `${args.code.slice(0, 500)}\n... (${args.code.length} chars total)` : args.code}\n\`\`\``
          : '';
        const prompt = `Debug this issue: ${args.problem}${errorContext}${expectedContext}${codePreview}`;

        return await executeDebate(server, env, ctx, 'debug-issue', JSON.stringify(args), userId, apiKeyHash, ip, {
          context: codeContext || undefined,
          format: 'discussion',
          mode: 'solving',
          prompt,
          roles: ['Root Cause Analyst', 'Systems Engineer', 'Edge Case Investigator'],
          thinkingLevel,
          webhookUrl: args.webhook_url,
        });
      } catch (e) {
        return debateErrorResult(e);
      }
    },
  );
}
