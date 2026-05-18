import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMcpAuthContext } from 'agents/mcp';
import { z } from 'zod';

import { getUserBalance, getUserPlanType } from '../engine/credit-tracker';
import { getUsageStatus } from '../engine/usage-limiter';
import { getAuthUserId } from '../lib/auth-context';
import { READ_ONLY_ANNOTATIONS } from '../schemas/tool-annotations';
import type { Env } from '../types';

export function register(server: McpServer, env: Env) {
  server.registerTool(
    'check-usage',
    {
      annotations: READ_ONLY_ANNOTATIONS,
      description: 'Check your remaining credits, usage limits, and plan info',
      inputSchema: z.object({
        verbose: z.boolean().default(false).optional().describe('Include detailed per-window rate limit breakdown'),
      }),
      outputSchema: z.object({
        credits: z.number().describe('Remaining credit balance'),
        plan: z.string().describe('Current plan tier'),
        rateLimits: z.object({
          daily: z.object({ count: z.number().describe('Requests used'), limit: z.number().describe('Request cap'), resetAt: z.string().describe('Reset timestamp') }).describe('Daily rate limit window'),
          fiveHour: z.object({ count: z.number().describe('Requests used'), limit: z.number().describe('Request cap'), resetAt: z.string().describe('Reset timestamp') }).describe('5-hour rate limit window'),
          weekly: z.object({ count: z.number().describe('Requests used'), limit: z.number().describe('Request cap'), resetAt: z.string().describe('Reset timestamp') }).describe('Weekly rate limit window'),
        }).describe('Rate limit status across all windows'),
        status: z.string().describe('Overall usage status'),
      }),
      title: 'Check Usage',
    },
    async () => {
      const auth = getMcpAuthContext();
      const userId = getAuthUserId(auth);

      const [planType, balance, usage] = await Promise.all([
        getUserPlanType(env, userId),
        getUserBalance(env, userId),
        getUserPlanType(env, userId).then(pt => getUsageStatus(env, userId, pt)),
      ]);

      const lines: string[] = [];

      lines.push('## Your MCP Usage');
      lines.push('');
      lines.push(`**Plan:** ${planType} | **Credits:** ${balance?.balance ?? 0}`);
      lines.push('');

      // Rate limits
      lines.push(`**Status:** ${usage.status}`);
      lines.push('');
      lines.push('| Window | Used/Limit | Resets |');
      lines.push('|--------|------------|--------|');
      lines.push(`| 5-hour | ${usage.fiveHour.count}/${usage.fiveHour.limit} | ${new Date(usage.fiveHour.resetAt).toUTCString()} |`);
      lines.push(`| Daily | ${usage.daily.count}/${usage.daily.limit} | ${new Date(usage.daily.resetAt).toUTCString()} |`);
      lines.push(`| Weekly | ${usage.weekly.count}/${usage.weekly.limit} | ${new Date(usage.weekly.resetAt).toUTCString()} |`);

      const structured = {
        credits: balance?.balance ?? 0,
        plan: planType,
        rateLimits: {
          daily: { count: usage.daily.count, limit: usage.daily.limit, resetAt: new Date(usage.daily.resetAt).toUTCString() },
          fiveHour: { count: usage.fiveHour.count, limit: usage.fiveHour.limit, resetAt: new Date(usage.fiveHour.resetAt).toUTCString() },
          weekly: { count: usage.weekly.count, limit: usage.weekly.limit, resetAt: new Date(usage.weekly.resetAt).toUTCString() },
        },
        status: usage.status,
      };

      return {
        content: [{ text: lines.join('\n'), type: 'text' as const }],
        structuredContent: structured,
      };
    },
  );
}
