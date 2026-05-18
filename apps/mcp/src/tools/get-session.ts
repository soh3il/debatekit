import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { formatMs } from '@debatekit/shared';
import { getMcpAuthContext } from 'agents/mcp';
import { z } from 'zod';

import { formatDebateAsMarkdown } from '../engine/format-markdown';
import { getSession } from '../engine/session-store';
import { getAuthUserId } from '../lib/auth-context';
import { READ_ONLY_ANNOTATIONS } from '../schemas/tool-annotations';
import { GetSessionInputSchema, RunDebateOutputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

export function register(server: McpServer, env: Env) {
  server.registerTool(
    'get-session',
    {
      annotations: READ_ONLY_ANNOTATIONS,
      description: 'Get full details of a previous MCP session by ID. Returns the complete result including participant responses and moderator synthesis. Use list-sessions first to find session IDs.',
      inputSchema: GetSessionInputSchema,
      outputSchema: z.object({
        createdAt: z.string().describe('Session creation timestamp'),
        durationMs: z.number().nullable().describe('Duration in milliseconds'),
        id: z.string().describe('Session identifier'),
        prompt: z.string().describe('Original prompt text'),
        qualityScore: z.number().nullable().describe('AI-rated quality score'),
        toolName: z.string().describe('Tool that was invoked'),
        totalCredits: z.number().nullable().describe('Total credits consumed'),
      }),
      title: 'Get Session',
    },
    async (args) => {
      const auth = getMcpAuthContext();
      const userId = getAuthUserId(auth);

      const session = await getSession(env, userId, args.session_id);

      if (!session) {
        return {
          content: [{ text: 'Session not found.', type: 'text' as const }],
          isError: true,
        };
      }

      const lines: string[] = [];

      // Session-specific metadata header (not in debate result)
      lines.push(`**ID:** \`${session.id}\` | **Tool:** ${session.toolName} | **Created:** ${session.createdAt.toUTCString()}`);
      if (session.durationMs) {
        lines.push(`**Duration:** ${formatMs(session.durationMs)} | **Credits:** ${session.totalCredits ?? '—'} | **Quality:** ${session.qualityScore ?? '—'}`);
      }
      lines.push('');

      // Reuse debate formatter if result is available
      if (session.resultJson) {
        try {
          const parsed = RunDebateOutputSchema.safeParse(JSON.parse(session.resultJson));
          if (parsed.success) {
            lines.push(formatDebateAsMarkdown(parsed.data, session.toolName, session.prompt));
          }
        } catch {
          // Malformed JSON in stored result — skip display
        }
      }

      const structured = {
        createdAt: session.createdAt.toUTCString(),
        durationMs: session.durationMs ?? null,
        id: session.id,
        prompt: session.prompt,
        qualityScore: session.qualityScore ?? null,
        toolName: session.toolName,
        totalCredits: session.totalCredits ?? null,
      };

      return {
        content: [{ text: lines.join('\n'), type: 'text' as const }],
        structuredContent: structured,
      };
    },
  );
}
