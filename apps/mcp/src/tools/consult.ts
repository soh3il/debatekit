import { DEFAULT_CHAT_MODE, DEFAULT_MCP_OUTPUT_FORMAT, DEFAULT_MCP_THINKING_LEVEL } from '@debatekit/shared/enums';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { analyzeForAutoMode } from '../engine/auto-mode';
import { MIN_PARTICIPANTS, THINKING_PRESETS } from '../engine/presets';
import { buildKnowledgeContext, buildPriorSessionContext } from '../lib/context-helpers';
import { debateErrorResult, executeDebate, resolveDebateAuth } from '../lib/debate-tool-runner';
import { DEBATE_ANNOTATIONS } from '../schemas/tool-annotations';
import { ConsultInputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

export function register(server: McpServer, env: Env, ctx: ExecutionContext) {
  server.registerTool(
    'consult-council',
    {
      annotations: DEBATE_ANNOTATIONS,
      description: 'Consult the AI coding council — multiple models discuss your engineering question sequentially (each sees prior responses), then a moderator synthesizes. Auto-mode by default — AI picks optimal models, roles, and conversation mode from your prompt. Provide explicit models to override (manual mode). Fully configurable: mode, format, roles, models, thinking level.',
      inputSchema: ConsultInputSchema,
      title: 'Consult Council',
    },
    async (args) => {
      try {
        const { apiKeyHash, ip, userId } = resolveDebateAuth();
        const thinkingLevel = args.thinking_level ?? DEFAULT_MCP_THINKING_LEVEL;
        const preset = THINKING_PRESETS[thinkingLevel];

        // Auto-mode when no models provided (matches web app default), manual when models specified
        const isAutoMode = !args.models;
        let resolvedModels: string[] | undefined = args.models;
        let resolvedRoles: string[] | undefined = args.roles;
        let resolvedMode = args.mode ?? DEFAULT_CHAT_MODE;

        if (isAutoMode && !args.auto_route) {
          const autoResult = await analyzeForAutoMode(args.prompt, thinkingLevel, env);
          resolvedModels = autoResult.models;
          resolvedRoles = autoResult.roles.filter((r): r is string => r !== null);
          if (!args.mode) {
            resolvedMode = autoResult.mode;
          }
        }

        const fallbackModels = resolvedModels && resolvedModels.length >= MIN_PARTICIPANTS ? resolvedModels : preset.defaultModels;
        let modelIds = fallbackModels;

        if (args.auto_route && (!resolvedModels || resolvedModels.length < MIN_PARTICIPANTS)) {
          const { routeModels } = await import('../engine/router');
          const routed = await routeModels(env, args.prompt, thinkingLevel);
          modelIds = routed.modelIds;
        }

        // Resolve prior session context and knowledge
        const priorContext = args.session_context?.length
          ? await buildPriorSessionContext(env, userId, args.session_context)
          : '';

        const knowledgeContext = args.knowledge?.length
          ? await buildKnowledgeContext(args.knowledge)
          : '';

        const combinedContext = knowledgeContext + priorContext + (args.context ?? '');
        const contextNote = args.context
          ? `\n\nContext: ${args.context.length > 300 ? `${args.context.slice(0, 300)}...` : args.context}`
          : '';
        const prompt = `${args.prompt}${contextNote}`;

        return await executeDebate(server, env, ctx, 'consult-council', JSON.stringify(args), userId, apiKeyHash, ip, {
          context: combinedContext || undefined,
          format: args.format ?? DEFAULT_MCP_OUTPUT_FORMAT,
          mode: resolvedMode,
          modelIds,
          prompt,
          roles: resolvedRoles,
          thinkingLevel,
          webhookUrl: args.webhook_url,
        });
      } catch (e) {
        return debateErrorResult(e);
      }
    },
  );
}
