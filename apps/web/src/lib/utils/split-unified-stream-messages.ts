/**
 * Split Unified Stream Messages
 *
 * During streaming, AI SDK's @ai-sdk-tools/store accumulates multiple
 * participant responses into a single UIMessage. The backend sends correct
 * start/finish boundaries per participant via createUIMessageStream,
 * but the store doesn't split them into separate messages.
 *
 * This function detects accumulated messages (multiple data-phase start
 * markers in the parts array) and splits them into per-participant
 * virtual UIMessages so buildParticipantMessageMaps can match them
 * correctly (it expects one message per participant).
 *
 * Runs at the view level (ChatView.tsx useMemo) to keep AI SDK internal
 * state intact while giving the rendering layer properly separated messages.
 *
 * @module lib/utils/split-unified-stream-messages
 */

import type { AiSdkPhaseStatus, StreamPhase } from '@debatekit/shared';
import { AiSdkPhaseStatuses, MODERATOR_PARTICIPANT_INDEX, PhaseMarkerDataSchema, StreamPhases } from '@debatekit/shared';
import type { UIMessage } from 'ai';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Minimal schema for data-phase fingerprinting, derived from the canonical PhaseMarkerDataSchema.
 * Picks only the fields used in buildPartsFingerprint to detect boundary-relevant changes.
 * participantIndex is optional in PhaseMarkerDataSchema so .partial() is not needed.
 */
const PhaseMarkerFingerprintSchema = PhaseMarkerDataSchema.pick({
  participantIndex: true,
  phase: true,
  status: true,
});

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal shape of a data-phase part in the UIMessage parts array.
 * AI SDK v6 stores custom data parts inline as { type: 'data-phase', data: PhaseMarkerData }.
 */
type DataPhasePart = {
  type: 'data-phase';
  data: {
    phase: StreamPhase;
    status: AiSdkPhaseStatus;
    participantIndex?: number;
    participantId?: string;
    totalParticipants?: number;
  };
};

/** Boundary detected in the parts array */
type SplitBoundary = {
  /** Index in the parts array where this participant's content starts */
  startIdx: number;
  /** Participant index from the data-phase marker (-99 for moderator) */
  participantIndex: number;
  /** Participant ID from the data-phase marker */
  participantId?: string;
  /** Phase type: 'presearch', 'participant', or 'moderator' */
  phase: StreamPhase;
};

// ============================================================================
// Cache
// ============================================================================

/**
 * WeakMap cache for completed messages.
 * Completed messages (no streaming text parts) won't change, so we cache
 * the split result to avoid recomputing on every render.
 * Streaming messages are excluded from cache since their parts array mutates.
 *
 * splitCacheFingerprint stores a content fingerprint at cache time.
 * AI SDK mutates the parts array in-place (appending, replacing, or modifying
 * parts). A simple length check is insufficient because content can change
 * without changing the array length. The fingerprint includes parts count,
 * each part's type, and text content lengths to detect any meaningful change.
 */
let splitCache = new WeakMap<UIMessage, UIMessage[]>();
let splitCacheFingerprint = new WeakMap<UIMessage, string>();

/**
 * Clear the split cache.
 * Called during navigation cleanup to prevent stale cached splits from a
 * previous thread leaking into the next thread's message rendering.
 * WeakMaps have no .clear() method, so we replace them with new instances.
 */
export function clearSplitCache() {
  splitCache = new WeakMap<UIMessage, UIMessage[]>();
  splitCacheFingerprint = new WeakMap<UIMessage, string>();
}

/**
 * Build a lightweight fingerprint for a message's parts array.
 * Captures the structure and content sizes so any in-place mutation
 * (new parts appended, text content grown, parts replaced) invalidates the cache.
 */
function buildPartsFingerprint(parts: UIMessage['parts']): string {
  if (!parts || parts.length === 0) {
    return '0';
  }
  // Include length + per-part type and content characteristics
  const segments: string[] = [String(parts.length)];
  for (const part of parts) {
    if ('type' in part && typeof part.type === 'string') {
      if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
        // For text parts, include the text length to detect content growth
        segments.push(`t:${part.text.length}`);
      } else if (part.type === 'reasoning' && 'text' in part && typeof part.text === 'string') {
        // Reasoning parts also use .text for content (not .reasoning)
        segments.push(`r:${part.text.length}`);
      } else if (part.type === 'data-phase' && 'data' in part && part.data && typeof part.data === 'object') {
        // Include boundary-relevant data-phase fields so cache invalidates if
        // participantIndex or phase change during progressive resume replay
        // Uses PhaseMarkerDataSchema.pick() for type-safe field extraction
        const parsed = PhaseMarkerFingerprintSchema.safeParse(part.data);
        if (parsed.success) {
          segments.push(`dp:${String(parsed.data.status)}:${String(parsed.data.phase)}:${String(parsed.data.participantIndex ?? '')}`);
        } else {
          segments.push('dp:unknown');
        }
      } else {
        // For other part types, just record the type
        segments.push(part.type);
      }
    }
  }
  return segments.join('|');
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Content part types to keep in virtual messages.
 * NOTE: 'data-phase' is intentionally EXCLUDED. data-phase parts are internal
 * boundary markers used only for split detection. Including them would cause
 * model-message-card's isDataPart() guard to render them as <CustomDataPart>
 * debug cards (blue cards with raw JSON), leaking phase metadata to the user.
 * All relevant metadata is already extracted into the virtual message's metadata property.
 *
 */
const CONTENT_PART_TYPES = new Set([
  'text',
  'reasoning',
  'tool-call',
  'tool-result',
  'file',
  'step-start',
]);

function isDataPhaseStart(part: unknown): part is DataPhasePart {
  if (!part || typeof part !== 'object') {
    return false;
  }
  if (!('type' in part) || part.type !== 'data-phase') {
    return false;
  }
  if (!('data' in part) || !part.data || typeof part.data !== 'object') {
    return false;
  }
  const data = part.data;
  if (!('status' in data) || !('phase' in data)) {
    return false;
  }
  return data.status === AiSdkPhaseStatuses.START
    && (data.phase === StreamPhases.PRESEARCH
      || data.phase === StreamPhases.PARTICIPANT
      || data.phase === StreamPhases.MODERATOR);
}

/** Check if any text part in the message is currently streaming */
function hasStreamingTextPart(message: UIMessage): boolean {
  if (!message.parts) {
    return false;
  }
  return message.parts.some(
    p => p.type === 'text' && 'state' in p && p.state === 'streaming',
  );
}

/**
 * Count data-phase start boundaries in a message's parts array.
 * Returns 0 for non-assistant messages or messages without data-phase parts.
 */
function countStartBoundaries(message: UIMessage): number {
  if (message.role !== 'assistant' || !message.parts) {
    return 0;
  }
  let count = 0;
  for (const part of message.parts) {
    if (isDataPhaseStart(part)) {
      count++;
    }
  }
  return count;
}

// ============================================================================
// Core Split Function
// ============================================================================

/**
 * Split accumulated multi-participant UIMessages into per-participant virtual messages.
 *
 * @param messages - Merged messages array (initialMessages + AI SDK messages)
 * @param participantModelLookup - Map of participantIndex → modelId for metadata enrichment
 * @returns Messages array with accumulated messages split into per-participant messages
 */
export function splitUnifiedStreamMessages(
  messages: UIMessage[],
  participantModelLookup?: Map<number, string>,
): UIMessage[] {
  if (messages.length === 0) {
    return messages;
  }

  let hasSplits = false;
  const result: UIMessage[] = [];

  for (const message of messages) {
    // Skip non-assistant messages
    if (message.role !== 'assistant') {
      result.push(message);
      continue;
    }

    // Check cache for completed messages (validate parts fingerprint hasn't changed)
    const cached = splitCache.get(message);
    if (cached) {
      const cachedFp = splitCacheFingerprint.get(message) ?? '';
      const currentFp = buildPartsFingerprint(message.parts);
      if (cachedFp === currentFp) {
        hasSplits = true;
        for (const m of cached) {
          result.push(m);
        }
        continue;
      }
      // Parts content changed (e.g. resumed stream, in-place mutation) — invalidate
    }

    // Count start boundaries to determine if splitting is needed
    const startCount = countStartBoundaries(message);
    if (startCount === 0) {
      // No boundaries: no split needed, pass through
      result.push(message);
      continue;
    }

    // Start boundary detected - split this message into virtual messages
    hasSplits = true;
    const virtualMessages = splitMessage(message, participantModelLookup);

    // Cache if message is complete (no streaming parts)
    if (!hasStreamingTextPart(message)) {
      splitCache.set(message, virtualMessages);
      splitCacheFingerprint.set(message, buildPartsFingerprint(message.parts));
    }

    for (const m of virtualMessages) {
      result.push(m);
    }
  }

  // If no splits happened, return original array reference (stable for useMemo)
  return hasSplits ? result : messages;
}

/**
 * Split a single accumulated message into per-participant virtual UIMessages.
 */
function splitMessage(
  message: UIMessage,
  participantModelLookup?: Map<number, string>,
): UIMessage[] {
  const parts = message.parts;
  if (!parts || parts.length === 0) {
    return [message];
  }

  // Find all start boundaries
  const boundaries: SplitBoundary[] = [];
  // Track participant-only boundary count for the fallback index.
  // Using boundaries.length would include presearch boundaries, giving P0
  // index 1 instead of 0 when presearch comes first.
  let participantBoundaryCount = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (isDataPhaseStart(part)) {
      // After isDataPhaseStart returns true, part is narrowed to DataPhasePart
      const isParticipantPhase = part.data.phase === StreamPhases.PARTICIPANT;
      boundaries.push({
        participantId: part.data.participantId,
        participantIndex: part.data.phase === StreamPhases.MODERATOR
          ? MODERATOR_PARTICIPANT_INDEX
          : (part.data.participantIndex ?? participantBoundaryCount),
        phase: part.data.phase,
        startIdx: i,
      });
      if (isParticipantPhase) {
        participantBoundaryCount++;
      }
    }
  }

  if (boundaries.length === 0) {
    return [message];
  }

  // Extract original metadata for roundNumber etc.
  const meta = message.metadata;
  const originalMeta = (meta && typeof meta === 'object' && !Array.isArray(meta))
    ? meta
    : {};
  const roundNumber = ('roundNumber' in originalMeta && typeof originalMeta.roundNumber === 'number')
    ? originalMeta.roundNumber
    : undefined;

  const virtualMessages: UIMessage[] = [];

  for (let bIdx = 0; bIdx < boundaries.length; bIdx++) {
    const boundary = boundaries[bIdx];
    if (!boundary) {
      continue;
    }
    const nextBoundary = boundaries[bIdx + 1];

    // Slice parts from this boundary to the next (or end of array)
    const endIdx = nextBoundary ? nextBoundary.startIdx : parts.length;
    const segmentParts = parts.slice(boundary.startIdx, endIdx);

    // Filter to content parts only (text, reasoning, tool-call, tool-result, file, step-start)
    // data-phase parts are excluded — they are internal boundary markers, not user content.
    const contentParts = segmentParts.filter((p) => {
      return 'type' in p && typeof p.type === 'string' && CONTENT_PART_TYPES.has(p.type);
    });

    // Generate virtual message ID
    const isPresearch = boundary.phase === StreamPhases.PRESEARCH;
    const isModerator = boundary.phase === StreamPhases.MODERATOR;
    const virtualId = isPresearch
      ? `pre-search-${message.id}_presearch`
      : isModerator
        ? `${message.id}_moderator`
        : `${message.id}_p${boundary.participantIndex}`;

    // Determine streaming status from text/reasoning part states.
    // COMPLETE markers are transient (not persisted in parts array), so the
    // only way to detect completion for virtual messages is checking if all
    // content parts have state: "done" (no "streaming" parts remain).
    const hasAnyStreamingPart = contentParts.some(
      p => ('state' in p && p.state === 'streaming'),
    );
    const hasAnyDonePart = contentParts.some(
      p => (p.type === 'text' || p.type === 'reasoning') && 'state' in p && p.state === 'done',
    );
    // isStreaming: false only if we have content parts that finished (done state)
    // and none are still streaming. If no state info, leave undefined (legacy).
    const segmentComplete = hasAnyDonePart && !hasAnyStreamingPart;

    // Build metadata for the virtual message
    // Presearch has no participant, so skip model lookup and participantIndex for it.
    // Including participantIndex on presearch would pollute buildParticipantMessageMaps'
    // byIndex map, potentially shadowing P0's entry if iteration order changes.
    const model = isPresearch ? undefined : participantModelLookup?.get(boundary.participantIndex);
    const virtualMetadata = {
      ...(roundNumber !== undefined && { roundNumber }),
      ...(boundary.participantId && { participantId: boundary.participantId }),
      ...(!isPresearch && boundary.participantIndex !== undefined && { participantIndex: boundary.participantIndex }),
      ...(model && { model }),
      role: 'assistant' as const,
      // Transfer completion status so getParticipantInfoForMessage can detect it
      ...(segmentComplete && { finishReason: 'stop', isStreaming: false }),
      // Mark presearch virtual messages so isPreSearch/isPreSearchFast filters them
      ...(isPresearch && {
        isPreSearch: true,
      }),
      ...(isModerator && {
        isModerator: true,
        participantIndex: MODERATOR_PARTICIPANT_INDEX,
        participantRole: 'Moderator',
      }),
    };

    const virtualMessage: UIMessage = {
      id: virtualId,
      metadata: virtualMetadata,
      parts: contentParts,
      role: 'assistant',
    };
    virtualMessages.push(virtualMessage);
  }

  return virtualMessages;
}
