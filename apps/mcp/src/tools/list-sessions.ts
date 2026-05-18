import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { formatMs } from '@debatekit/shared';
import { getMcpAuthContext } from 'agents/mcp';
import { z } from 'zod';

import { listSessions } from '../engine/session-store';
import { getAuthUserId } from '../lib/auth-context';
import { READ_ONLY_ANNOTATIONS } from '../schemas/tool-annotations';
import { ListSessionsInputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

export function register(server: McpServer, env: Env) {
  server.registerTool(
    'list-sessions',
    {
      annotations: READ_ONLY_ANNOTATIONS,
      description: 'List your previous MCP tool sessions. Returns session metadata including prompt, tool used, quality score, and credits consumed. Useful for reviewing past council discussions.',
      inputSchema: ListSessionsInputSchema,
      outputSchema: z.object({
        hasMore: z.boolean().describe('Whether more results are available'),
        sessions: z.array(z.object({
          credits: z.number().nullable().describe('Credits consumed'),
          durationMs: z.number().nullable().describe('Duration in milliseconds'),
          id: z.string().describe('Session identifier'),
          prompt: z.string().describe('Original prompt text'),
          thinkingLevel: z.string().nullable().describe('Thinking level used'),
          toolName: z.string().describe('Tool that was invoked'),
        }).describe('Session entry')).describe('List of sessions'),
      }),
      title: 'List Sessions',
    },
    async (args) => {
      const auth = getMcpAuthContext();
      const userId = getAuthUserId(auth);

      const sessions = await listSessions(env, userId, {
        limit: args.limit,
        offset: args.offset,
        toolName: args.tool_name,
      });

      if (sessions.length === 0) {
        return {
          content: [{ text: 'No sessions found.', type: 'text' as const }],
        };
      }

      const lines: string[] = [];
      lines.push(`## Sessions (${sessions.length})`);
      lines.push('');
      lines.push('| # | Tool | Prompt | Thinking | Credits | Duration | ID |');
      lines.push('|---|------|--------|----------|---------|----------|----|');

      for (const [i, s] of sessions.entries()) {
        const prompt = s.prompt.length > 60 ? `${s.prompt.slice(0, 57)}...` : s.prompt;
        const duration = s.durationMs ? formatMs(s.durationMs) : '—';
        const credits = s.totalCredits ?? '—';
        const thinking = s.thinkingLevel ?? '—';
        lines.push(`| ${i + 1} | ${s.toolName} | ${prompt} | ${thinking} | ${credits} | ${duration} | \`${s.id.slice(0, 8)}\` |`);
      }

      if (sessions.length === args.limit) {
        lines.push('');
        lines.push(`Showing ${args.offset + 1}-${args.offset + sessions.length}. More available — use \`offset: ${args.offset + args.limit}\``);
      }

      const structured = {
        hasMore: sessions.length === args.limit,
        sessions: sessions.map(s => ({
          credits: s.totalCredits ?? null,
          durationMs: s.durationMs ?? null,
          id: s.id,
          prompt: s.prompt,
          thinkingLevel: s.thinkingLevel ?? null,
          toolName: s.toolName,
        })),
      };

      return {
        content: [{ text: lines.join('\n'), type: 'text' as const }],
        structuredContent: structured,
      };
    },
  );
}
