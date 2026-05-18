import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMcpAuthContext } from 'agents/mcp';
import { z } from 'zod';

import { queryLogs } from '../engine/logger';
import { getAuthUserId } from '../lib/auth-context';
import { READ_ONLY_ANNOTATIONS } from '../schemas/tool-annotations';
import { GetLogsInputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

/** Schema for JSON-serializable log data values (flat key-value payloads) */
const LogDataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const LogDataSchema = z.record(z.string(), LogDataValueSchema);
type LogData = z.infer<typeof LogDataSchema>;

/** Safely parse a JSON string into a typed log data record */
function parseLogData(json: string): LogData | null {
  try {
    const result = LogDataSchema.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function register(server: McpServer, env: Env) {
  server.registerTool(
    'get-logs',
    {
      annotations: READ_ONLY_ANNOTATIONS,
      description: 'Query structured logs from your MCP tool executions. Filter by session, severity level, event type, and time range. Useful for debugging and monitoring tool usage.',
      inputSchema: GetLogsInputSchema,
      outputSchema: z.object({
        logs: z.array(z.object({
          data: LogDataSchema.nullable().describe('Structured log data payload'),
          event: z.string().describe('Event name'),
          level: z.string().describe('Log severity level'),
          sessionId: z.string().nullable().describe('Associated session identifier'),
          time: z.string().describe('Log timestamp'),
        }).describe('Log entry')).describe('Matching log entries'),
      }),
      title: 'Get Logs',
    },
    async (args) => {
      const auth = getMcpAuthContext();
      const userId = getAuthUserId(auth);

      const logs = await queryLogs(env, userId, {
        endTime: args.end_time,
        event: args.event,
        level: args.level,
        limit: args.limit,
        offset: args.offset,
        sessionId: args.session_id,
        startTime: args.start_time,
      });

      if (logs.length === 0) {
        return {
          content: [{ text: 'No logs found.', type: 'text' as const }],
        };
      }

      const lines: string[] = [];
      lines.push(`## Logs (${logs.length})`);
      lines.push('');
      lines.push('| Time | Level | Event | Session | Details |');
      lines.push('|------|-------|-------|---------|---------|');

      for (const l of logs) {
        const time = l.createdAt.toISOString().slice(0, 19).replace('T', ' ');
        const session = l.sessionId ? `\`${l.sessionId.slice(0, 8)}\`` : '—';
        let details = '—';
        if (l.dataJson) {
          const data = parseLogData(l.dataJson);
          if (data) {
            const keys = Object.keys(data).slice(0, 3);
            details = keys.map(k => `${k}: ${String(data[k]).slice(0, 30)}`).join(', ');
          } else {
            details = l.dataJson.slice(0, 50);
          }
        }
        lines.push(`| ${time} | ${l.level} | ${l.event} | ${session} | ${details} |`);
      }

      const structured = {
        logs: logs.map(l => ({
          data: l.dataJson ? parseLogData(l.dataJson) : null,
          event: l.event,
          level: l.level,
          sessionId: l.sessionId ?? null,
          time: l.createdAt.toISOString(),
        })),
      };

      return {
        content: [{ text: lines.join('\n'), type: 'text' as const }],
        structuredContent: structured,
      };
    },
  );
}
