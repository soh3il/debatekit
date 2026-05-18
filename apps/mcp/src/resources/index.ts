import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMultiplierForModelId } from '@debatekit/shared';
import { MCP_THINKING_LEVELS } from '@debatekit/shared/enums';
import { getMcpAuthContext } from 'agents/mcp';

import { getUserBalance, getUserPlanType } from '../engine/credit-tracker';
import { ensureRegistry, getAllRegistryModels } from '../engine/model-registry';
import { THINKING_PRESETS } from '../engine/presets';
import { getUsageStatus } from '../engine/usage-limiter';
import { getAuthUserId } from '../lib/auth-context';
import type { Env } from '../types';

export function registerResources(server: McpServer, env: Env) {
  server.registerResource(
    'usage',
    'debatekit://usage',
    {
      description: 'Current credit balance, plan type, and rate limit status',
      mimeType: 'application/json',
      title: 'Usage & Credits',
    },
    async (uri) => {
      const auth = getMcpAuthContext();
      const userId = getAuthUserId(auth);

      const [planType, balance, usage] = await Promise.all([
        getUserPlanType(env, userId),
        getUserBalance(env, userId),
        getUserPlanType(env, userId).then(pt => getUsageStatus(env, userId, pt)),
      ]);

      const data = {
        credits: balance?.balance ?? 0,
        plan: planType,
        rateLimits: {
          daily: { count: usage.daily.count, limit: usage.daily.limit },
          fiveHour: { count: usage.fiveHour.count, limit: usage.fiveHour.limit },
          weekly: { count: usage.weekly.count, limit: usage.weekly.limit },
        },
        status: usage.status,
      };

      return {
        contents: [{
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
          uri: uri.href,
        }],
      };
    },
  );

  server.registerResource(
    'models',
    'debatekit://models',
    {
      description: 'Available AI models grouped by thinking level with credit multipliers',
      mimeType: 'application/json',
      title: 'Available Models',
    },
    async (uri) => {
      await ensureRegistry(env);
      const registryModels = await getAllRegistryModels(env);
      const registryMap = new Map(registryModels.map(m => [m.id, m]));

      const data = MCP_THINKING_LEVELS.map((level) => {
        const preset = THINKING_PRESETS[level];
        return {
          label: preset.label,
          level,
          models: preset.defaultModels.map(id => ({
            capabilities: registryMap.get(id)?.capabilities ?? [],
            id,
            multiplier: getMultiplierForModelId(id),
          })),
          moderator: {
            id: preset.moderatorModel,
            multiplier: getMultiplierForModelId(preset.moderatorModel),
          },
        };
      });

      return {
        contents: [{
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
          uri: uri.href,
        }],
      };
    },
  );
}
