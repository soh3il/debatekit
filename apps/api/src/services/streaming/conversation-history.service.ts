/**
 * Conversation History Service
 *
 * Provides conversation history loading and pruning for multi-round context management.
 * Enables participants to see messages from prior rounds, giving them the context needed
 * to provide coherent, contextual responses.
 *
 * Key responsibilities:
 * - Load messages from prior rounds from D1 database
 * - Filter out moderator and pre-search messages (not part of user conversation)
 * - Convert prior assistant messages to user role with attribution
 * - Apply AI SDK v6 pruneMessages() for intelligent context management
 * - Respect memory limits (75 messages default, 100 max)
 *
 * @module api/services/streaming/conversation-history
 * @see /docs/backend-patterns.md for streaming patterns
 */

import type { ModelMessage } from 'ai';
import { and, asc, eq, lt } from 'drizzle-orm';
import * as z from 'zod';

import type { AppDb } from '@/db';
import * as tables from '@/db';
import {
  isModeratorMessageMetadata,
  isPreSearchMessageMetadata,
} from '@/db/schemas/chat-metadata';
import { getAssistantMetadata } from '@/lib/utils/metadata';
import type { TypedLogger } from '@/types/logger';
import { LogHelpers } from '@/types/logger';

import { extractReadableModelName } from './stream-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default maximum messages to load from history.
 * Matches DEFAULT_MAX_CONTEXT_MESSAGES from memory-safety.ts
 */
const DEFAULT_MAX_HISTORY_MESSAGES = 75;

/**
 * Absolute maximum messages to prevent memory issues.
 * Matches ABSOLUTE_MAX_CONTEXT_MESSAGES from memory-safety.ts
 */
const ABSOLUTE_MAX_HISTORY_MESSAGES = 100;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parameters for loading conversation history
 */
type LoadConversationHistoryParams = {
  currentRoundNumber: number;
  db: AppDb;
  logger?: TypedLogger;
  maxMessages?: number;
  threadId: string;
};

export const LoadConversationHistoryParamsSchema: z.ZodType<LoadConversationHistoryParams> = z.object({
  /** Current round number (will load all messages from rounds 0..currentRound-1) */
  currentRoundNumber: z.number().int().nonnegative(),
  /** Database client */
  db: z.custom<AppDb>(),
  /** Optional logger for debugging */
  logger: z.custom<TypedLogger>().optional(),
  /** Maximum messages to load (defaults to 75, max 100) */
  maxMessages: z.number().int().positive().max(ABSOLUTE_MAX_HISTORY_MESSAGES).optional(),
  /** Thread ID to load history from */
  threadId: z.string().min(1),
});

/**
 * Statistics about loaded conversation history
 */
type HistoryStats = {
  /** Number of messages after filtering (excludes moderator, pre-search) */
  filteredCount: number;
  /** Highest round number in history */
  maxRoundNumber: number;
  /** Number of messages loaded from DB (before filtering) */
  rawCount: number;
  /** Number of user messages */
  userMessageCount: number;
};

/**
 * Result of loading conversation history
 */
type ConversationHistoryResult = {
  /** Converted ModelMessage array for AI SDK */
  messages: ModelMessage[];
  /** Statistics about the loaded history */
  stats: HistoryStats;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// extractReadableModelName imported from ./stream-utils

/**
 * Extract participant role for attribution using Zod-validated metadata extraction.
 * Uses getAssistantMetadata() from @/lib/utils/metadata for type-safe parsing.
 */
function extractParticipantInfo(metadata: unknown): { model: string; role: string | null } {
  const validated = getAssistantMetadata(metadata);
  if (validated) {
    return { model: extractReadableModelName(validated.model), role: validated.participantRole };
  }
  return { model: 'unknown', role: null };
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Load conversation history from prior rounds.
 *
 * Loads all messages from rounds 0..(currentRoundNumber-1) and converts them
 * to ModelMessage format suitable for AI SDK streamText().
 *
 * Key behaviors:
 * - Filters out moderator messages (isModerator: true)
 * - Filters out pre-search messages (isPreSearch: true)
 * - Converts prior assistant messages to user role with attribution prefix
 * - Respects maxMessages limit
 *
 * @param params - Loading parameters
 * @returns Promise with messages array and stats
 */
async function loadConversationHistory(
  params: LoadConversationHistoryParams,
): Promise<ConversationHistoryResult> {
  const { currentRoundNumber, db, logger, threadId } = params;
  const maxMessages = Math.min(
    params.maxMessages ?? DEFAULT_MAX_HISTORY_MESSAGES,
    ABSOLUTE_MAX_HISTORY_MESSAGES,
  );

  // Skip if this is round 0 (no prior history)
  if (currentRoundNumber === 0) {
    logger?.debug('Skipping history load for round 0', LogHelpers.operation({
      operationName: 'loadConversationHistory',
      roundNumber: currentRoundNumber,
      threadId,
    }));
    return {
      messages: [],
      stats: {
        filteredCount: 0,
        maxRoundNumber: -1,
        rawCount: 0,
        userMessageCount: 0,
      },
    };
  }

  logger?.debug('Loading conversation history', LogHelpers.operation({
    messageCount: maxMessages,
    operationName: 'loadConversationHistory',
    roundNumber: currentRoundNumber,
    threadId,
  }));

  // =========================================================================
  // STEP 1: Query messages from prior rounds
  // =========================================================================
  const dbMessages = await db
    .select()
    .from(tables.chatMessage)
    .where(and(
      eq(tables.chatMessage.threadId, threadId),
      lt(tables.chatMessage.roundNumber, currentRoundNumber),
    ))
    .orderBy(
      asc(tables.chatMessage.roundNumber),
      asc(tables.chatMessage.createdAt),
    )
    .limit(maxMessages * 2); // Over-fetch to account for filtering

  const rawCount = dbMessages.length;

  // =========================================================================
  // STEP 2: Filter out moderator and pre-search messages
  // =========================================================================
  const filteredMessages = dbMessages.filter((msg) => {
    const metadata = msg.metadata;
    if (!metadata) {
      return true;
    }

    // Skip moderator messages - they're synthesis, not part of conversation
    if (isModeratorMessageMetadata(metadata)) {
      return false;
    }

    // Skip pre-search messages - they're system context, not conversation
    if (isPreSearchMessageMetadata(metadata)) {
      return false;
    }

    return true;
  });

  // Apply final message limit after filtering
  const limitedMessages = filteredMessages.slice(-maxMessages);

  // =========================================================================
  // STEP 3: Convert to ModelMessage format
  // =========================================================================
  const modelMessages: ModelMessage[] = [];
  let userMessageCount = 0;
  let maxRoundNumber = -1;

  for (const msg of limitedMessages) {
    // Track max round number
    if (msg.roundNumber > maxRoundNumber) {
      maxRoundNumber = msg.roundNumber;
    }

    // Extract text content from parts
    const textContent = msg.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map(part => part.text)
      .join('\n');

    if (!textContent) {
      continue;
    }

    if (msg.role === 'user') {
      // User messages stay as user role
      userMessageCount++;
      modelMessages.push({
        content: textContent,
        role: 'user',
      });
    } else if (msg.role === 'assistant') {
      // Prior assistant messages become user messages with attribution
      // This prevents the current model from thinking IT said these things
      const { model, role } = extractParticipantInfo(msg.metadata);
      const attribution = role
        ? `[Previous response from ${role} (${model})]:`
        : `[Previous response from ${model}]:`;

      modelMessages.push({
        content: `${attribution}\n${textContent}`,
        role: 'user',
      });
    }
  }

  logger?.info('Loaded conversation history', LogHelpers.operation({
    loadedCount: rawCount,
    messageCount: limitedMessages.length,
    operationName: 'loadConversationHistory',
    resultCount: modelMessages.length,
    roundNumber: maxRoundNumber,
    threadId,
    userMessages: userMessageCount,
  }));

  return {
    messages: modelMessages,
    stats: {
      filteredCount: limitedMessages.length,
      maxRoundNumber,
      rawCount,
      userMessageCount,
    },
  };
}

/**
 * Apply AI SDK v6 pruneMessages() for intelligent context management.
 *
 * Prunes messages to:
 * - Remove reasoning from all but the last message
 * - Remove tool calls from all but the last 2 messages
 * - Remove empty messages after pruning
 *
 * @param messages - Messages to prune
 * @returns Pruned messages array
 */
async function pruneConversationHistory(
  messages: ModelMessage[],
): Promise<ModelMessage[]> {
  if (messages.length === 0) {
    return [];
  }

  // Lazy load AI SDK to avoid startup cost
  const { pruneMessages } = await import('ai');

  return pruneMessages({
    emptyMessages: 'remove',
    messages,
    reasoning: 'before-last-message',
    toolCalls: 'before-last-2-messages',
  });
}

/**
 * Load and prune conversation history in one call.
 *
 * Convenience function that combines loadConversationHistory and pruneConversationHistory.
 *
 * @param params - Loading parameters
 * @returns Promise with pruned messages and stats
 */
export async function loadAndPruneConversationHistory(
  params: LoadConversationHistoryParams,
): Promise<ConversationHistoryResult> {
  const result = await loadConversationHistory(params);

  if (result.messages.length === 0) {
    return result;
  }

  const prunedMessages = await pruneConversationHistory(result.messages);

  params.logger?.debug('Pruned conversation history', LogHelpers.operation({
    loadedCount: result.messages.length,
    operationName: 'loadAndPruneConversationHistory',
    resultCount: prunedMessages.length,
    threadId: params.threadId,
  }));

  return {
    messages: prunedMessages,
    stats: {
      ...result.stats,
      filteredCount: prunedMessages.length,
    },
  };
}
