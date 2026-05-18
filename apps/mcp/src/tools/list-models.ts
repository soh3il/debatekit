import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMultiplierForModelId } from '@debatekit/shared';
import type { McpThinkingLevel } from '@debatekit/shared/enums';
import { MCP_THINKING_LEVELS } from '@debatekit/shared/enums';
import { z } from 'zod';

import { ensureRegistry, getAllRegistryModels } from '../engine/model-registry';
import { THINKING_PRESETS } from '../engine/presets';
import { READ_ONLY_ANNOTATIONS } from '../schemas/tool-annotations';
import { ListModelsInputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

function formatLevelMarkdown(level: McpThinkingLevel, registryMap: Map<string, { capabilities: string[]; id: string }>) {
  const preset = THINKING_PRESETS[level];
  const lines: string[] = [];

  lines.push(`### ${preset.label}`);
  lines.push(preset.description);
  lines.push('');
  lines.push('| Model | Credit Multiplier | Capabilities |');
  lines.push('|-------|------------------|--------------|');

  for (const id of preset.defaultModels) {
    const caps = registryMap.get(id)?.capabilities ?? [];
    const capsStr = caps.length > 0 ? caps.join(', ') : '—';
    lines.push(`| ${id} | ${getMultiplierForModelId(id)}x | ${capsStr} |`);
  }

  lines.push('');
  lines.push(`Moderator: ${preset.moderatorModel} (${getMultiplierForModelId(preset.moderatorModel)}x)`);

  return lines.join('\n');
}

export function register(server: McpServer, env: Env) {
  server.registerTool(
    'list-models',
    {
      annotations: READ_ONLY_ANNOTATIONS,
      description: 'List available AI models grouped by thinking level (low/medium/high). Shows default models, credit costs, capabilities for each tier. Use this before consult to understand model options.',
      inputSchema: ListModelsInputSchema,
      outputSchema: z.object({
        levels: z.array(z.object({
          label: z.string().describe('Human-readable tier name'),
          level: z.string().describe('Thinking level identifier'),
          models: z.array(z.object({
            capabilities: z.array(z.string()).describe('Model capabilities'),
            id: z.string().describe('Model identifier'),
            multiplier: z.number().describe('Credit cost multiplier'),
          }).describe('Available model')).describe('Models in this tier'),
          moderator: z.object({ id: z.string().describe('Moderator model identifier'), multiplier: z.number().describe('Credit cost multiplier') }).describe('Moderator model for this tier'),
        }).describe('Thinking level tier')).describe('Available thinking level tiers'),
      }),
      title: 'List Models',
    },
    async (args) => {
      await ensureRegistry(env);
      const registryModels = await getAllRegistryModels(env);
      const registryMap = new Map(registryModels.map(m => [m.id, m]));

      const lines: string[] = ['## Available Models', ''];

      const levels = args.thinking_level ? [args.thinking_level] : [...MCP_THINKING_LEVELS];

      for (const level of levels) {
        lines.push(formatLevelMarkdown(level, registryMap));
        lines.push('');
      }

      const structured = {
        levels: levels.map((level) => {
          const p = THINKING_PRESETS[level];
          return {
            label: p.label,
            level,
            models: p.defaultModels.map(id => ({
              capabilities: registryMap.get(id)?.capabilities ?? [],
              id,
              multiplier: getMultiplierForModelId(id),
            })),
            moderator: { id: p.moderatorModel, multiplier: getMultiplierForModelId(p.moderatorModel) },
          };
        }),
      };

      return {
        content: [{ text: lines.join('\n'), type: 'text' as const }],
        structuredContent: structured,
      };
    },
  );
}
