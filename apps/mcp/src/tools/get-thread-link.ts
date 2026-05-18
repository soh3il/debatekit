import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDb } from '@debatekit/db/factory';
import { findThreadByMcpSessionId, verifySessionOwnership } from '@debatekit/db/services';
import { getMcpAuthContext } from 'agents/mcp';
import { z } from 'zod';

import { getAuthUserId } from '../lib/auth-context';
import { getPublicThreadUrl, getThreadUrl } from '../lib/url-resolver';
import { READ_ONLY_ANNOTATIONS } from '../schemas/tool-annotations';
import { GetThreadLinkInputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

export function register(server: McpServer, env: Env) {
  server.registerTool(
    'get-thread-link',
    {
      annotations: READ_ONLY_ANNOTATIONS,
      description: 'Get the dashboard URL for a previous debate session. Returns the thread link and public URL if the thread is public.',
      inputSchema: GetThreadLinkInputSchema,
      outputSchema: z.object({
        dashboardUrl: z.string().describe('Dashboard URL to view the thread'),
        isPublic: z.boolean().describe('Whether the thread is publicly accessible'),
        publicUrl: z.string().nullable().describe('Public share URL if thread is public'),
      }),
      title: 'Get Thread Link',
    },
    async (args) => {
      const auth = getMcpAuthContext();
      const userId = getAuthUserId(auth);
      const db = createDb(env.DB);

      const sessionExists = await verifySessionOwnership(db, args.session_id, userId);
      if (!sessionExists) {
        return {
          content: [{ text: 'Session not found.', type: 'text' as const }],
          isError: true,
        };
      }

      const thread = await findThreadByMcpSessionId(db, userId, args.session_id);
      if (!thread) {
        return {
          content: [{ text: 'No thread associated with this session. The thread may not have been created yet.', type: 'text' as const }],
          isError: true,
        };
      }

      const dashboardUrl = getThreadUrl(env, thread.slug);
      const lines = [`**Dashboard URL:** [Open Thread](${dashboardUrl})`];
      const publicUrl = thread.isPublic ? getPublicThreadUrl(env, thread.slug) : undefined;

      if (thread.isPublic && publicUrl) {
        lines.push(`**Public URL:** [Share Link](${publicUrl})`);
      } else {
        lines.push('');
        lines.push('> Thread is currently private. Use `set-thread-visibility` to make it public.');
      }

      const structured = {
        dashboardUrl,
        isPublic: thread.isPublic,
        publicUrl: publicUrl ?? null,
      };

      return {
        content: [
          { text: lines.join('\n'), type: 'text' as const },
          {
            description: 'View this session in the DebateKit app',
            name: `thread-${thread.slug}`,
            title: 'View in DebateKit app',
            type: 'resource_link' as const,
            uri: dashboardUrl,
          },
        ],
        structuredContent: structured,
      };
    },
  );
}
