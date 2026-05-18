import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpThinkingLevels } from '@debatekit/shared/enums';

import { debateErrorResult, executeDebate, resolveDebateAuth } from '../lib/debate-tool-runner';
import { DEBATE_ANNOTATIONS } from '../schemas/tool-annotations';
import { ArchitectInputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

export function register(server: McpServer, env: Env, ctx: ExecutionContext) {
  server.registerTool(
    'design-architecture',
    {
      annotations: DEBATE_ANNOTATIONS,
      description: 'Architecture design council. Systems Architect, Infrastructure Engineer, and DX Advocate evaluate your system design. Always uses high thinking for maximum depth. Output as ADR.',
      inputSchema: ArchitectInputSchema,
      title: 'Design Architecture',
    },
    async (args) => {
      try {
        const { apiKeyHash, ip, userId } = resolveDebateAuth();

        const techContext = args.tech_stack?.length ? `\n\nPreferred tech: ${args.tech_stack.join(', ')}` : '';
        const focusContext = args.focus_areas?.length ? `\n\nFocus areas: ${args.focus_areas.join(', ')}` : '';
        const prompt = `Design the architecture for: ${args.description}\n\nScale: ${args.scale}${techContext}${focusContext}`;

        return await executeDebate(server, env, ctx, 'design-architecture', JSON.stringify(args), userId, apiKeyHash, ip, {
          format: 'adr',
          mode: 'analyzing',
          prompt,
          roles: ['Systems Architect', 'Infrastructure Engineer', 'DX Advocate'],
          thinkingLevel: McpThinkingLevels.HIGH,
          webhookUrl: args.webhook_url,
        });
      } catch (e) {
        return debateErrorResult(e);
      }
    },
  );
}
