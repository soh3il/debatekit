import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDb } from '@debatekit/db/factory';
import { findThreadByMcpSessionId, updateThreadVisibility, verifySessionOwnership } from '@debatekit/db/services';
import { getMcpAuthContext } from 'agents/mcp';
import { z } from 'zod';

import { getAuthUserId } from '../lib/auth-context';
import { getPublicThreadUrl } from '../lib/url-resolver';
import { MUTATING_ANNOTATIONS } from '../schemas/tool-annotations';
import { SetThreadVisibilityInputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

export function register(server: McpServer, env: Env) {
  server.registerTool(
    'set-thread-visibility',
    {
      annotations: MUTATING_ANNOTATIONS,
      description: 'Set a thread as public or private. Public threads can be shared via URL. Use session_id from a previous debate session.',
      inputSchema: SetThreadVisibilityInputSchema,
      outputSchema: z.object({
        isPublic: z.boolean().describe('Current visibility state'),
        publicUrl: z.string().nullable().describe('Public share URL if thread is public'),
      }),
      title: 'Set Thread Visibility',
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

      const updated = await updateThreadVisibility(db, thread.id, userId, args.is_public);
      if (!updated) {
        return {
          content: [{ text: 'Thread not found or you do not have permission to modify it.', type: 'text' as const }],
          isError: true,
        };
      }

      if (args.is_public) {
        const publicUrl = getPublicThreadUrl(env, thread.slug);
        return {
          content: [{ text: `Thread is now **public**.\n\n**Public URL:** ${publicUrl}`, type: 'text' as const }],
          structuredContent: { isPublic: true, publicUrl },
        };
      }

      return {
        content: [{ text: 'Thread is now **private**.', type: 'text' as const }],
        structuredContent: { isPublic: false, publicUrl: null },
      };
    },
  );
}
