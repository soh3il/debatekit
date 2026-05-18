/**
 * MCP Thread Creator
 *
 * Thin wrapper over @debatekit/db shared thread creation service.
 * Delegates all DB operations to the Drizzle-based service.
 */

import { createDb } from '@debatekit/db/factory';
import { createThreadFromDebate as _createThreadFromDebate } from '@debatekit/db/services';

import type { Env } from '../types';

export async function createThreadFromDebate(params: {
  context?: string;
  env: Env;
  mode: string;
  moderatorModelId: string;
  moderatorSummary: string;
  participants: Array<{ model_id: string; model_name: string; response: string; role?: string }>;
  prompt: string;
  sessionId: string;
  title?: string;
  toolName: string;
  userId: string;
}) {
  return _createThreadFromDebate(createDb(params.env.DB), {
    context: params.context,
    mode: params.mode,
    moderatorModelId: params.moderatorModelId,
    moderatorSummary: params.moderatorSummary,
    participants: params.participants.map(p => ({
      modelId: p.model_id,
      modelName: p.model_name,
      response: p.response,
      role: p.role,
    })),
    prompt: params.prompt,
    sessionId: params.sessionId,
    title: params.title,
    toolName: params.toolName,
    userId: params.userId,
  });
}
