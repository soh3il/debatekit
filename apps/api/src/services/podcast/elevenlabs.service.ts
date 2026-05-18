/**
 * ElevenLabs Integration Service
 *
 * Converts podcast scripts to audio using the official ElevenLabs JS SDK.
 * Uses `client.textToDialogue.stream()` for multi-voice dialogue synthesis with progressive streaming.
 *
 * Docs: https://elevenlabs.io/docs/api-reference/text-to-dialogue/stream
 *
 * Constraints:
 * - Max 10 unique voice IDs per request
 * - Max 5,000 characters per request (chunked automatically)
 */

import { ElevenLabsClient, ElevenLabsError, ElevenLabsTimeoutError } from '@elevenlabs/elevenlabs-js';
import * as z from 'zod';

import type { DbPodcastScript } from '@/db/schemas/chat-metadata';
import { log } from '@/lib/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Bytes per second at 128kbps MP3.
 * Approximate (~3-8% off due to MP3 frame headers/padding).
 * Frontend uses real audio.duration on playback for accuracy.
 */
const BYTES_PER_SECOND_128KBPS = 16_000;

/**
 * Maximum number of unique voice IDs allowed per textToDialogue request.
 * Enforced by ElevenLabs API.
 */
const MAX_UNIQUE_VOICES = 10;

/**
 * Maximum characters per textToDialogue request.
 * ElevenLabs enforces a 5,000 character limit.
 * Use 4,900 as a safe threshold to avoid edge cases.
 */
const MAX_CHARS_PER_REQUEST = 4_900;

/**
 * Maximum total characters for an entire podcast episode.
 * Episodes are capped at ~5 minutes. At ~1300 chars/min TTS pace, 6500 chars ≈ 5 min.
 */
const MAX_EPISODE_CHARS = 6_500;

/**
 * Per-chunk generation timeout in milliseconds.
 * If a single chunk takes longer than this, abort and retry.
 */
const PER_CHUNK_TIMEOUT_MS = 120_000; // 2 minutes per chunk (episodes are shorter)

/**
 * Total generation timeout in milliseconds.
 * If the entire generation exceeds this, abort.
 */
const TOTAL_GENERATION_TIMEOUT_MS = 300_000; // 5 minutes (episodes are ~5 min max)

// ============================================================================
// SCHEMAS
// ============================================================================

const _LineTimingSchema = z.object({
  endMs: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
});

const _ElevenLabsResultSchema = z.object({
  audioBuffer: z.instanceof(ArrayBuffer),
  durationMs: z.number().int().nonnegative(),
  lineTimings: z.array(_LineTimingSchema),
}).strict();

export type ElevenLabsResult = z.infer<typeof _ElevenLabsResultSchema>;

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Typed error for ElevenLabs API failures.
 * Distinguishes retryable (429, 500+) from non-retryable (401, 403, 422) errors.
 */
export class ElevenLabsApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | undefined,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ElevenLabsApiError';
  }
}

function isRetryableStatusCode(statusCode: number | undefined): boolean {
  if (statusCode === undefined) {
    return true; // Network errors are retryable
  }
  if (statusCode === 429) {
    return true;
  }
  if (statusCode >= 500) {
    return true;
  }
  return false;
}

/**
 * Convert an SDK error into our ElevenLabsApiError.
 * Leverages SDK's typed error hierarchy (ElevenLabsError has .statusCode, .body).
 */
function wrapSdkError(error: unknown): ElevenLabsApiError {
  // SDK timeout errors are always retryable
  if (error instanceof ElevenLabsTimeoutError) {
    return new ElevenLabsApiError(error.message, undefined, true);
  }

  // SDK API errors carry statusCode and body directly
  if (error instanceof ElevenLabsError) {
    return new ElevenLabsApiError(
      error.message,
      error.statusCode,
      isRetryableStatusCode(error.statusCode),
    );
  }

  // Unexpected errors (network failures, etc.) are retryable
  const message = error instanceof Error ? error.message : String(error);
  return new ElevenLabsApiError(message, undefined, true);
}

// ============================================================================
// TIMEOUT UTILITY
// ============================================================================

/**
 * Wrap a promise with a timeout. Rejects with ElevenLabsApiError if timeout exceeded.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new ElevenLabsApiError(`Timeout after ${timeoutMs}ms: ${label}`, undefined, true)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

// ============================================================================
// SDK CLIENT
// ============================================================================

/**
 * Create an ElevenLabs SDK client instance.
 * Retries disabled — handled at the queue consumer level with exponential backoff.
 */
function createClient(apiKey: string) {
  return new ElevenLabsClient({
    apiKey,
    maxRetries: 0,
  });
}

/**
 * Consume a ReadableStream<Uint8Array> into a single ArrayBuffer.
 * The SDK does not provide a built-in stream-to-buffer utility.
 */
async function streamToArrayBuffer(
  stream: ReadableStream<Uint8Array>,
  onByteProgress?: (receivedBytes: number, getBuffer: () => ArrayBuffer) => void,
): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  const getBuffer = (): ArrayBuffer => {
    const combined = new Uint8Array(totalLength);
    let off = 0;
    for (const chunk of chunks) {
      combined.set(chunk, off);
      off += chunk.byteLength;
    }
    return combined.buffer;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    totalLength += value.byteLength;
    onByteProgress?.(totalLength, getBuffer);
  }

  return getBuffer();
}

// ============================================================================
// SDK API CALL
// ============================================================================

const DialogueInputSchema = z.object({
  text: z.string(),
  voiceId: z.string(),
});
type DialogueInput = z.infer<typeof DialogueInputSchema>;

/**
 * Call the ElevenLabs textToDialogue API via the official SDK (streaming).
 * Returns the audio as an ArrayBuffer.
 */
async function callTextToDialogue(
  client: ElevenLabsClient,
  inputs: DialogueInput[],
  languageCode?: string,
  onByteProgress?: (receivedBytes: number, getBuffer: () => ArrayBuffer) => void,
): Promise<ArrayBuffer> {
  try {
    const audioStream = await client.textToDialogue.stream({
      applyTextNormalization: 'on',
      inputs: inputs.map(input => ({
        text: input.text,
        voiceId: input.voiceId,
      })),
      ...(languageCode && languageCode !== 'en' ? { languageCode } : {}),
      modelId: 'eleven_v3',
      outputFormat: 'mp3_44100_128',
    });

    return streamToArrayBuffer(audioStream, onByteProgress);
  } catch (error) {
    throw wrapSdkError(error);
  }
}

/**
 * Voice segment returned from the timestamps endpoint, normalized to milliseconds.
 */
const _VoiceSegmentTimingSchema = z.object({
  /** Index of the dialogue input this segment corresponds to */
  dialogueInputIndex: z.number().int().nonnegative(),
  endTimeMs: z.number().int().nonnegative(),
  startTimeMs: z.number().int().nonnegative(),
  voiceId: z.string(),
});
type VoiceSegmentTiming = z.infer<typeof _VoiceSegmentTimingSchema>;

/**
 * Call the ElevenLabs textToDialogue with timestamps API.
 * Returns audio buffer AND precise per-voice-segment timing data.
 * Note: This endpoint does NOT support streaming - returns complete response.
 */
async function callTextToDialogueWithTimestamps(
  client: ElevenLabsClient,
  inputs: DialogueInput[],
  languageCode?: string,
): Promise<{ audioBuffer: ArrayBuffer; voiceSegments: VoiceSegmentTiming[] }> {
  try {
    const result = await client.textToDialogue.convertWithTimestamps({
      applyTextNormalization: 'on',
      inputs: inputs.map(input => ({
        text: input.text,
        voiceId: input.voiceId,
      })),
      ...(languageCode && languageCode !== 'en' ? { languageCode } : {}),
      modelId: 'eleven_v3',
      outputFormat: 'mp3_44100_128',
    });

    // Decode base64 audio to ArrayBuffer
    const binaryString = atob(result.audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const voiceSegments: VoiceSegmentTiming[] = (result.voiceSegments ?? []).map(seg => ({
      dialogueInputIndex: seg.dialogueInputIndex,
      endTimeMs: Math.round(seg.endTimeSeconds * 1000),
      startTimeMs: Math.round(seg.startTimeSeconds * 1000),
      voiceId: seg.voiceId,
    }));

    return {
      audioBuffer: bytes.buffer,
      voiceSegments,
    };
  } catch (error) {
    throw wrapSdkError(error);
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that the script does not exceed the 10 unique voice limit.
 * Throws if the limit is exceeded.
 */
function validateVoiceCount(script: DbPodcastScript): void {
  const uniqueVoices = new Set(script.lines.map(l => l.voiceId));
  if (uniqueVoices.size > MAX_UNIQUE_VOICES) {
    throw new Error(
      `Script uses ${uniqueVoices.size} unique voices, but ElevenLabs allows max ${MAX_UNIQUE_VOICES}`,
    );
  }
}

// ============================================================================
// CHUNKING
// ============================================================================

/**
 * Split dialogue inputs into chunks that fit within the character limit.
 * Each chunk's total text length stays under MAX_CHARS_PER_REQUEST.
 * Lines are never split mid-text — chunks break at line boundaries.
 *
 * The SDK does not handle chunking — this is application-level logic
 * because we concatenate multi-chunk audio into a single podcast file.
 */
function chunkLines(lines: DialogueInput[]): DialogueInput[][] {
  const chunks: DialogueInput[][] = [];
  let currentChunk: DialogueInput[] = [];
  let currentChars = 0;

  for (const line of lines) {
    const lineChars = line.text.length;

    // If a single line exceeds the limit, truncate it to fit
    if (lineChars > MAX_CHARS_PER_REQUEST) {
      // Flush current chunk first
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentChars = 0;
      }
      chunks.push([{
        text: line.text.slice(0, MAX_CHARS_PER_REQUEST),
        voiceId: line.voiceId,
      }]);
      continue;
    }

    // If adding this line would exceed the limit, start a new chunk
    if (currentChars + lineChars > MAX_CHARS_PER_REQUEST && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }

    currentChunk.push({ text: line.text, voiceId: line.voiceId });
    currentChars += lineChars;
  }

  // Push remaining lines
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Result of merging short inputs. Tracks which original line indices
 * were folded into each merged input for per-line timing estimation.
 */
const _MergeResultSchema = z.object({
  /** For each merged input, which original line indices it contains */
  lineIndexMap: z.array(z.array(z.number())),
  merged: z.array(DialogueInputSchema),
});
type MergeResult = z.infer<typeof _MergeResultSchema>;

/**
 * Merge consecutive inputs with the same voiceId when combined length < 250 chars.
 * ElevenLabs warns that prompts shorter than ~250 chars may yield inconsistent output.
 * Applied BEFORE chunking — preserves voice assignment while meeting minimum length.
 *
 * Returns both the merged inputs and a parallel array mapping each merged entry
 * back to the original line indices it contains.
 */
const MIN_INPUT_CHARS = 250;

function mergeShortInputs(inputs: DialogueInput[]): MergeResult {
  const merged: DialogueInput[] = [];
  const lineIndexMap: number[][] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    if (!input) {
      continue;
    }
    const lastIdx = merged.length - 1;
    const last = lastIdx >= 0 ? merged[lastIdx] : undefined;
    const lastMap = lastIdx >= 0 ? lineIndexMap[lastIdx] : undefined;

    if (last && lastMap && last.voiceId === input.voiceId && last.text.length + input.text.length < MIN_INPUT_CHARS) {
      last.text = `${last.text} ${input.text}`;
      lastMap.push(i);
    } else {
      merged.push({ text: input.text, voiceId: input.voiceId });
      lineIndexMap.push([i]);
    }
  }

  return { lineIndexMap, merged };
}

// ============================================================================
// TRUNCATION
// ============================================================================

/**
 * Truncate dialogue inputs to fit within a total character budget.
 * Uses proportional reduction: every input is shrunk by the same ratio
 * so all speakers are represented (instead of dropping later speakers entirely).
 * Cuts at sentence boundaries when possible.
 */
function truncateToCharLimit(inputs: DialogueInput[], maxChars: number): DialogueInput[] {
  const totalChars = inputs.reduce((sum, l) => sum + l.text.length, 0);
  if (totalChars <= maxChars) {
    return inputs;
  }

  const ratio = maxChars / totalChars;
  const truncated: DialogueInput[] = [];

  for (const input of inputs) {
    const targetLen = Math.max(Math.floor(input.text.length * ratio), 50);
    if (input.text.length <= targetLen) {
      truncated.push(input);
    } else {
      const text = input.text.slice(0, targetLen);
      const lastPeriod = text.lastIndexOf('.');
      truncated.push({
        text: lastPeriod > targetLen * 0.5 ? text.slice(0, lastPeriod + 1) : text,
        voiceId: input.voiceId,
      });
    }
  }

  return truncated;
}

// ============================================================================
// AUDIO GENERATION
// ============================================================================

/**
 * Generate podcast audio from a script using ElevenLabs textToDialogue SDK.
 *
 * Scripts exceeding 5,000 characters are automatically chunked into
 * multiple API calls and the resulting audio buffers are concatenated.
 *
 * @param script - The podcast script with dialogue lines and voice IDs
 * @param apiKey - ElevenLabs API key from environment
 * @param onChunkProgress - Optional callback for chunk progress updates
 * @param languageCode - BCP-47 language code (default 'en')
 * @returns Audio buffer (MP3 128kbps) and estimated duration in milliseconds
 */
export async function generatePodcastAudio(
  script: DbPodcastScript,
  apiKey: string,
  onChunkProgress?: (completedChunks: number, totalChunks: number, cumulativeBuffer: ArrayBuffer) => Promise<void>,
  languageCode = 'en',
  onStreamProgress?: (params: { chunkIndex: number; getCumulativeBuffer: () => ArrayBuffer; receivedBytes: number; totalChunks: number }) => Promise<void>,
  mode?: string,
): Promise<ElevenLabsResult> {
  validateVoiceCount(script);

  const client = createClient(apiKey);

  // Merge short consecutive lines with same voice to meet 250-char minimum.
  // lineIndexMap tracks which original script.lines indices folded into each merged input.
  const { lineIndexMap, merged: rawMergedInputs } = mergeShortInputs(
    script.lines.map(l => ({ text: l.text, voiceId: l.voiceId })),
  );

  // Guard against overly long scripts that risk timeouts and high costs
  const safeMergedInputs = truncateToCharLimit(rawMergedInputs, MAX_EPISODE_CHARS);
  if (safeMergedInputs.length < rawMergedInputs.length) {
    log.warn('[PODCAST] Script exceeds maximum character limit, truncating', {
      limit: MAX_EPISODE_CHARS,
      originalInputs: rawMergedInputs.length,
      title: script.title,
      totalChars: rawMergedInputs.reduce((sum, l) => sum + l.text.length, 0),
      truncatedInputs: safeMergedInputs.length,
    });
  }

  const mergedInputs = safeMergedInputs;
  const totalChars = mergedInputs.reduce((sum, l) => sum + l.text.length, 0);
  const chunks = chunkLines(mergedInputs);
  const uniqueVoiceIds = [...new Set(mergedInputs.map(l => l.voiceId))];

  // Build a mapping from each merged input index to its chunk index.
  // We walk the chunks array and assign each merged input back.
  const mergedToChunkIndex: number[] = [];
  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunkEntries = chunks[chunkIdx];
    if (!chunkEntries) {
      continue;
    }
    for (let ci = 0; ci < chunkEntries.length; ci++) {
      mergedToChunkIndex.push(chunkIdx);
    }
  }

  // For single-chunk scripts without stream progress, use the timestamps endpoint
  // to get precise per-voice-segment timing data instead of character-proportion estimates.
  const usePreciseTimings = chunks.length === 1 && !onStreamProgress;

  log.info('[PODCAST] Generating audio', {
    chunks: chunks.length,
    languageCode,
    lineCount: script.lines.length,
    mergedInputCount: mergedInputs.length,
    mode: mode ?? 'default',
    title: script.title,
    totalChars,
    uniqueVoices: uniqueVoiceIds.length,
    usePreciseTimings,
    voiceIds: uniqueVoiceIds.join(','),
  });

  try {
    const audioBuffers: ArrayBuffer[] = [];
    const chunkDurationsMs: number[] = [];
    const generationStartTime = Date.now();
    let preciseVoiceSegments: VoiceSegmentTiming[] | undefined;

    for (const [i, chunk] of chunks.entries()) {
      // Guard total generation time
      if (Date.now() - generationStartTime > TOTAL_GENERATION_TIMEOUT_MS) {
        throw new ElevenLabsApiError(
          `Total generation timeout exceeded (${TOTAL_GENERATION_TIMEOUT_MS}ms) after ${i}/${chunks.length} chunks`,
          undefined,
          true,
        );
      }

      const chunkChars = chunk.reduce((sum, input) => sum + input.text.length, 0);

      log.info('[PODCAST] Generating chunk', {
        chunkChars,
        chunkIndex: i + 1,
        chunkLines: chunk.length,
        totalChunks: chunks.length,
        usePreciseTimings,
      });

      let buffer: ArrayBuffer;

      if (usePreciseTimings && chunks.length === 1) {
        // Single-chunk: use timestamps endpoint for precise timing data
        const result = await withTimeout(
          callTextToDialogueWithTimestamps(client, chunk, languageCode),
          PER_CHUNK_TIMEOUT_MS,
          'timestamps chunk',
        );
        buffer = result.audioBuffer;
        preciseVoiceSegments = result.voiceSegments;
      } else {
        // Multi-chunk or streaming: use streaming endpoint
        const byteProgressCallback = onStreamProgress
          ? (receivedBytes: number, getCurrentChunkBuffer: () => ArrayBuffer) => {
              // Build cumulative buffer lazily: all completed chunks + current partial
              const getCumulativeBuffer = () => concatenateBuffers([...audioBuffers, getCurrentChunkBuffer()]);
              // Fire-and-forget to avoid blocking the stream read loop
              onStreamProgress({ chunkIndex: i, getCumulativeBuffer, receivedBytes, totalChunks: chunks.length }).catch(() => {});
            }
          : undefined;

        buffer = await withTimeout(
          callTextToDialogue(client, chunk, languageCode, byteProgressCallback),
          PER_CHUNK_TIMEOUT_MS,
          `chunk ${i + 1}/${chunks.length}`,
        );
      }

      // Compute per-chunk duration from buffer size at known bitrate
      const chunkDurationMs = Math.round((buffer.byteLength / BYTES_PER_SECOND_128KBPS) * 1000);
      chunkDurationsMs.push(chunkDurationMs);

      audioBuffers.push(buffer);
      const cumulativeBuffer = concatenateBuffers(audioBuffers);
      await onChunkProgress?.(i + 1, chunks.length, cumulativeBuffer);
    }

    // Concatenate all chunk buffers into one
    const audioBuffer = concatenateBuffers(audioBuffers);

    // Total estimated duration from buffer size at known bitrate (128kbps)
    const estimatedDurationMs = Math.round(
      (audioBuffer.byteLength / BYTES_PER_SECOND_128KBPS) * 1000,
    );

    // ----------------------------------------------------------------
    // Compute per-line timings by distributing chunk durations
    // ----------------------------------------------------------------

    // Step 1: Distribute each chunk's duration across its merged inputs by character proportion
    const mergedDurationsMs: number[] = Array.from({ length: mergedInputs.length }, () => 0);
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      if (!chunk) {
        continue;
      }
      const chunkDurationMs = chunkDurationsMs[chunkIdx] ?? 0;
      const chunkTotalChars = chunk.reduce((sum, input) => sum + input.text.length, 0);

      if (chunkTotalChars === 0) {
        continue;
      }

      // Find the merged input indices that belong to this chunk
      let assignedMs = 0;
      const mergedIndicesInChunk: number[] = [];
      for (let mi = 0; mi < mergedInputs.length; mi++) {
        if (mergedToChunkIndex[mi] === chunkIdx) {
          mergedIndicesInChunk.push(mi);
        }
      }

      for (let j = 0; j < mergedIndicesInChunk.length; j++) {
        const mi = mergedIndicesInChunk[j];
        if (mi === undefined) {
          continue;
        }
        const isLast = j === mergedIndicesInChunk.length - 1;
        if (isLast) {
          // Give remainder to last to avoid rounding drift
          mergedDurationsMs[mi] = chunkDurationMs - assignedMs;
        } else {
          const mergedInput = mergedInputs[mi];
          const proportion = mergedInput ? mergedInput.text.length / chunkTotalChars : 0;
          const ms = Math.round(chunkDurationMs * proportion);
          mergedDurationsMs[mi] = ms;
          assignedMs += ms;
        }
      }
    }

    // Step 2: Distribute each merged input's duration back to original lines by character proportion.
    // Also compute cumulative offset so we can assign startMs/endMs.
    const lineTimings: Array<{ endMs: number; startMs: number }> = Array.from(
      { length: script.lines.length },
      () => ({ endMs: 0, startMs: 0 }),
    );
    let cumulativeMs = 0;

    for (let mi = 0; mi < mergedInputs.length; mi++) {
      const originalIndices = lineIndexMap[mi];
      if (!originalIndices) {
        continue;
      }
      const mergedMs = mergedDurationsMs[mi] ?? 0;
      const mergedTotalChars = originalIndices.reduce(
        (sum, idx) => {
          const line = script.lines[idx];
          return sum + (line ? line.text.length : 0);
        },
        0,
      );

      if (mergedTotalChars === 0 || originalIndices.length === 0) {
        // Edge case: empty text lines get zero-width timings
        for (const idx of originalIndices) {
          lineTimings[idx] = { endMs: cumulativeMs, startMs: cumulativeMs };
        }
        continue;
      }

      let assignedMs = 0;
      for (let j = 0; j < originalIndices.length; j++) {
        const idx = originalIndices[j];
        if (idx === undefined) {
          continue;
        }
        const isLast = j === originalIndices.length - 1;
        const line = script.lines[idx];
        const lineMs = isLast
          ? mergedMs - assignedMs
          : Math.round(mergedMs * ((line ? line.text.length : 0) / mergedTotalChars));

        lineTimings[idx] = {
          endMs: cumulativeMs + lineMs,
          startMs: cumulativeMs,
        };
        cumulativeMs += lineMs;
        assignedMs += lineMs;
      }
    }

    // Override with precise timings from timestamps endpoint when available.
    // Voice segments have dialogueInputIndex mapping back to merged inputs,
    // so we distribute each segment's timing to the original script lines
    // using the lineIndexMap (merged input index -> original line indices).
    if (preciseVoiceSegments && preciseVoiceSegments.length > 0) {
      // Build a map from merged input index to its voice segment timing.
      // Multiple segments can share a dialogueInputIndex if ElevenLabs splits
      // within a single input, so we take the min start / max end.
      const mergedTimings = new Map<number, { endTimeMs: number; startTimeMs: number }>();
      for (const seg of preciseVoiceSegments) {
        const existing = mergedTimings.get(seg.dialogueInputIndex);
        if (existing) {
          existing.startTimeMs = Math.min(existing.startTimeMs, seg.startTimeMs);
          existing.endTimeMs = Math.max(existing.endTimeMs, seg.endTimeMs);
        } else {
          mergedTimings.set(seg.dialogueInputIndex, {
            endTimeMs: seg.endTimeMs,
            startTimeMs: seg.startTimeMs,
          });
        }
      }

      // Distribute each merged input's precise timing to its original lines
      // by character proportion within the merged group.
      for (const [mi, timing] of mergedTimings) {
        const originalIndices = lineIndexMap[mi];
        if (!originalIndices || originalIndices.length === 0) {
          continue;
        }

        const segDurationMs = timing.endTimeMs - timing.startTimeMs;
        const segTotalChars = originalIndices.reduce((sum, idx) => {
          const line = script.lines[idx];
          return sum + (line ? line.text.length : 0);
        }, 0);

        if (segTotalChars === 0) {
          for (const idx of originalIndices) {
            lineTimings[idx] = { endMs: timing.startTimeMs, startMs: timing.startTimeMs };
          }
          continue;
        }

        let offsetMs = timing.startTimeMs;
        let assignedMs = 0;
        for (let j = 0; j < originalIndices.length; j++) {
          const idx = originalIndices[j];
          if (idx === undefined) {
            continue;
          }
          const isLast = j === originalIndices.length - 1;
          const line = script.lines[idx];
          const lineMs = isLast
            ? segDurationMs - assignedMs
            : Math.round(segDurationMs * ((line ? line.text.length : 0) / segTotalChars));

          lineTimings[idx] = {
            endMs: offsetMs + lineMs,
            startMs: offsetMs,
          };
          offsetMs += lineMs;
          assignedMs += lineMs;
        }
      }

      log.info('[PODCAST] Applied precise voice segment timings', {
        lineCount: script.lines.length,
        segmentCount: preciseVoiceSegments.length,
      });
    }

    log.info('[PODCAST] Audio generated', {
      chunks: chunks.length,
      durationMs: estimatedDurationMs,
      preciseTimings: !!preciseVoiceSegments,
      sizeBytes: audioBuffer.byteLength,
      title: script.title,
    });

    return {
      audioBuffer,
      durationMs: estimatedDurationMs,
      lineTimings,
    };
  } catch (error) {
    // Re-throw ElevenLabsApiError as-is (already has full error info)
    if (error instanceof ElevenLabsApiError) {
      log.error('[PODCAST] ElevenLabs generation failed', {
        error: error.message,
        lineCount: script.lines.length,
        retryable: error.retryable,
        statusCode: error.statusCode,
        title: script.title,
        totalChars,
      });
      throw error;
    }

    // Unexpected errors (network, etc.)
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('[PODCAST] ElevenLabs generation failed (unexpected)', {
      error: errorMessage,
      lineCount: script.lines.length,
      title: script.title,
      totalChars,
    });

    throw new ElevenLabsApiError(errorMessage, undefined, true);
  }
}

// ============================================================================
// BUFFER UTILITIES
// ============================================================================

/**
 * Concatenate multiple ArrayBuffers into one.
 */
function concatenateBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return combined.buffer;
}
