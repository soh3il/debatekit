/**
 * MCP Structured Logger
 *
 * Thin wrapper over @debatekit/db shared log service.
 * Fire-and-forget via ctx.waitUntil for non-blocking logging.
 */

import { createDb } from '@debatekit/db/factory';
import type { LogEventParams } from '@debatekit/db/services';
import {
  logEvent as _logEvent,
  queryLogs as _queryLogs,
} from '@debatekit/db/services';
import type { McpLogLevel } from '@debatekit/shared/enums';

import type { Env } from '../types';

async function logEvent(env: Env, params: LogEventParams) {
  return _logEvent(createDb(env.DB), params);
}

export function logEventFireAndForget(env: Env, ctx: ExecutionContext, params: LogEventParams) {
  ctx.waitUntil(
    logEvent(env, params).catch((err) => {
      console.error('[logger] Failed to log event:', err);
    }),
  );
}

export async function queryLogs(
  env: Env,
  userId: string,
  options: {
    endTime?: number;
    event?: string;
    level?: McpLogLevel;
    limit?: number;
    offset?: number;
    sessionId?: string;
    startTime?: number;
  },
) {
  return _queryLogs(createDb(env.DB), userId, options);
}
