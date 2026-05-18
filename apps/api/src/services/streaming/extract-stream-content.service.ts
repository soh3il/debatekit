/**
 * Extract Stream Content Service
 *
 * Extracts accumulated text content from Redis stream chunks for SSR.
 * This allows the server to render partial streaming content during page load.
 *
 * @module api/services/streaming/extract-stream-content
 */

import type { StreamPhase, UnifiedStreamChunk } from '@debatekit/shared/types';
import { StreamPhases, UnifiedPhaseStatuses } from '@debatekit/shared/types';

import type { RedisEnv } from './unified-redis-stream-buffer.service';
import {
  getUnifiedChunksAndState,
  getUnifiedRoundState,
} from './unified-redis-stream-buffer.service';

// ============================================================================
// TYPES
// ============================================================================

/** Extracted content for a single participant */
export type ParticipantContent = {
  index: number;
  text: string;
  reasoning: string;
};

/** Streaming state to include in API response */
export type StreamingState = {
  /** The round number being streamed */
  roundNumber: number;
  /** Current streaming phase */
  currentPhase: StreamPhase;
  /** Index of currently streaming participant (if in participant phase) */
  currentParticipantIndex: number | null;
  /** Total participants in this round */
  totalParticipants: number;
  /** Accumulated text content for each participant */
  participantContent: ParticipantContent[];
  /** Accumulated moderator content */
  moderatorContent: string;
  /** Last sequence number for resumption */
  lastSeq: number;
  /** Whether presearch phase is active */
  presearchActive: boolean;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract text content from unified stream chunks.
 *
 * Parses through all chunks and accumulates text/reasoning deltas
 * for each participant and moderator.
 *
 * @param chunks - Array of unified stream chunks
 * @returns Map of participant index to content, plus moderator content
 */
function extractContentFromChunks(
  chunks: UnifiedStreamChunk[],
): {
  participantContent: Map<number, { text: string; reasoning: string }>;
  moderatorContent: string;
  currentParticipantIndex: number | null;
  totalParticipants: number;
} {
  const participantContent = new Map<number, { text: string; reasoning: string }>();
  let moderatorContent = '';
  let currentParticipantIndex: number | null = null;
  let totalParticipants = 0;

  for (const chunk of chunks) {
    if (chunk.type === 'phase-start') {
      if (chunk.phase === StreamPhases.PARTICIPANT) {
        currentParticipantIndex = chunk.participantIndex ?? null;
        totalParticipants = chunk.totalParticipants ?? totalParticipants;

        // Initialize content for this participant if not exists
        if (currentParticipantIndex !== null && !participantContent.has(currentParticipantIndex)) {
          participantContent.set(currentParticipantIndex, { reasoning: '', text: '' });
        }
      }
    } else if (chunk.type === 'phase-complete') {
      if (chunk.phase === StreamPhases.PARTICIPANT) {
        // Keep currentParticipantIndex as the last completed one for now
        // It will be updated on next phase-start
      }
    } else if (chunk.type === 'text-delta') {
      if (chunk.phase === StreamPhases.PARTICIPANT && currentParticipantIndex !== null) {
        const existing = participantContent.get(currentParticipantIndex) ?? { reasoning: '', text: '' };
        existing.text += chunk.content;
        participantContent.set(currentParticipantIndex, existing);
      } else if (chunk.phase === StreamPhases.MODERATOR) {
        moderatorContent += chunk.content;
      }
    } else if (chunk.type === 'reasoning-delta') {
      if (chunk.phase === StreamPhases.PARTICIPANT && currentParticipantIndex !== null) {
        const existing = participantContent.get(currentParticipantIndex) ?? { reasoning: '', text: '' };
        existing.reasoning += chunk.content;
        participantContent.set(currentParticipantIndex, existing);
      }
    }
  }

  return {
    currentParticipantIndex,
    moderatorContent,
    participantContent,
    totalParticipants,
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Get streaming state for a thread.
 *
 * Checks if there's an active stream for any round of the thread,
 * and if so, extracts the accumulated content for SSR.
 *
 * @param threadId - The thread ID to check
 * @param maxRoundNumber - Maximum round number to check (usually latest round)
 * @param env - Redis environment
 * @returns StreamingState if active stream exists, null otherwise
 */
export async function getStreamingState(
  threadId: string,
  maxRoundNumber: number,
  env: RedisEnv,
): Promise<StreamingState | null> {
  // Check rounds from most recent to oldest
  for (let roundNumber = maxRoundNumber; roundNumber >= 0; roundNumber--) {
    const state = await getUnifiedRoundState(threadId, roundNumber, env);

    // Skip if no state or stream is completed
    if (!state) {
      continue;
    }

    // Check if any phase is still active (not all complete/error/skipped)
    const { phaseStatuses } = state;
    const allPhasesTerminal = (
      (phaseStatuses.presearch === UnifiedPhaseStatuses.COMPLETE
        || phaseStatuses.presearch === UnifiedPhaseStatuses.SKIPPED
        || phaseStatuses.presearch === UnifiedPhaseStatuses.ERROR)
      && (phaseStatuses.participant === UnifiedPhaseStatuses.COMPLETE
        || phaseStatuses.participant === UnifiedPhaseStatuses.ERROR)
      && (phaseStatuses.moderator === UnifiedPhaseStatuses.COMPLETE
        || phaseStatuses.moderator === UnifiedPhaseStatuses.ERROR)
    );

    if (allPhasesTerminal) {
      continue;
    }

    // Found an active stream - extract content
    const { chunks } = await getUnifiedChunksAndState(threadId, roundNumber, 0, env);
    const {
      currentParticipantIndex,
      moderatorContent,
      participantContent,
      totalParticipants,
    } = extractContentFromChunks(chunks);

    // Convert Map to array
    const participantContentArray: ParticipantContent[] = [];
    participantContent.forEach((content, index) => {
      participantContentArray.push({
        index,
        reasoning: content.reasoning,
        text: content.text,
      });
    });

    // Sort by index
    participantContentArray.sort((a, b) => a.index - b.index);

    return {
      currentParticipantIndex,
      currentPhase: state.currentPhase,
      lastSeq: chunks.length,
      moderatorContent,
      participantContent: participantContentArray,
      presearchActive: phaseStatuses.presearch === UnifiedPhaseStatuses.ACTIVE,
      roundNumber,
      totalParticipants,
    };
  }

  return null;
}
