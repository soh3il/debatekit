/**
 * Shared context resolution helpers for MCP tools.
 * Handles session context prepending and knowledge injection.
 */

import type { z } from 'zod';

import type { KnowledgeItemSchema } from '../engine/context-augmentor';
import { resolveSessionContext } from '../engine/session-store';
import { RunDebateOutputSchema } from '../schemas/tool-schemas';
import type { Env } from '../types';

/**
 * Resolves prior session IDs into a formatted context string.
 * Safely handles malformed JSON in session results.
 */
export async function buildPriorSessionContext(env: Env, userId: string, sessionIds: string[]) {
  const sessions = await resolveSessionContext(env, userId, sessionIds);
  if (sessions.length === 0) {
    return '';
  }

  return `${sessions.map((s) => {
    let summary = 'N/A';
    try {
      const parsed = RunDebateOutputSchema.safeParse(JSON.parse(s.resultJson));
      if (parsed.success) {
        summary = parsed.data.moderator.summary;
      }
    } catch {
      // Malformed JSON in stored result — skip
    }
    return `## Prior Session: ${s.toolName}\n**Question:** ${s.prompt}\n**Summary:** ${summary}`;
  }).join('\n\n')}\n\n---\n\n`;
}

/**
 * Resolves knowledge items into formatted context string.
 */
export async function buildKnowledgeContext(knowledge: z.infer<typeof KnowledgeItemSchema>[]) {
  const { formatKnowledge, resolveKnowledge } = await import('../engine/context-augmentor');
  const resolved = await resolveKnowledge(knowledge);
  return formatKnowledge(resolved);
}
