/**
 * MCP Session Store
 *
 * Thin wrapper over @debatekit/db/services that adds env-based DB creation.
 * All SQL and Drizzle logic lives in the shared service; this file only
 * adapts the (env: Env, ...) signature expected by MCP callers.
 */

import { createDb } from '@debatekit/db/factory';
import type { SaveSessionParams } from '@debatekit/db/services';
import {
  getAvgTokensByThinkingLevel as _getAvgTokensByThinkingLevel,
  getSession as _getSession,
  linkSessionToThread as _linkSessionToThread,
  listSessions as _listSessions,
  resolveSessionContext as _resolveSessionContext,
  saveSession as _saveSession,
  updateQualityScore as _updateQualityScore,
} from '@debatekit/db/services';
import type { McpEvaluationStatus } from '@debatekit/shared/enums';

import type { Env } from '../types';

export async function saveSession(env: Env, params: SaveSessionParams) {
  return _saveSession(createDb(env.DB), params);
}

export async function getSession(env: Env, userId: string, sessionId: string) {
  return _getSession(createDb(env.DB), userId, sessionId);
}

export async function listSessions(env: Env, userId: string, options: { limit?: number; offset?: number; toolName?: string }) {
  return _listSessions(createDb(env.DB), userId, options);
}

export async function updateQualityScore(env: Env, userId: string, sessionId: string, qualityScore: number, evaluationStatus: Exclude<McpEvaluationStatus, 'pending'>) {
  return _updateQualityScore(createDb(env.DB), userId, sessionId, qualityScore, evaluationStatus);
}

export async function getAvgTokensByThinkingLevel(env: Env, userId: string, thinkingLevel: string) {
  return _getAvgTokensByThinkingLevel(createDb(env.DB), userId, thinkingLevel);
}

export async function resolveSessionContext(env: Env, userId: string, sessionIds: string[]) {
  return _resolveSessionContext(createDb(env.DB), userId, sessionIds);
}

export async function linkSessionToThread(env: Env, userId: string, sessionId: string, threadId: string) {
  return _linkSessionToThread(createDb(env.DB), userId, sessionId, threadId);
}
