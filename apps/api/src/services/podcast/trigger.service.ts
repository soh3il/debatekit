/**
 * Podcast Auto-Generation Trigger Service
 *
 * Triggers podcast generation via Cloudflare Queue after round completion.
 * Errors propagate to queue consumer for retries (not swallowed).
 *
 * Status transitions:
 * PENDING → GENERATING_SCRIPT → GENERATING_AUDIO → COMPLETED
 *     ↓           ↓                  ↓
 *   FAILED      FAILED             FAILED
 */

import { MessagePartTypes, PodcastScopes, PodcastStatuses, UIMessageRoles } from '@debatekit/shared/enums';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import * as z from 'zod';

import { invalidatePublicThreadCache } from '@/common/cache-utils';
import { TITLE_GENERATION_MODEL_ID } from '@/core/ai-models';
import { getDbAsync } from '@/db';
import * as tables from '@/db';
import type { DbMessageParts } from '@/db/schemas/chat-metadata';
import { log } from '@/lib/logger';
import { deductCreditsForAction } from '@/services/billing/credit.service';
import { initializeOpenRouter, openRouterService } from '@/services/models';
import { detectLanguage } from '@/services/prompts/language-detection';
import { deleteFile, putFile } from '@/services/uploads/storage.service';
import type { ApiEnv } from '@/types';

import { generatePodcastAudio } from './elevenlabs.service';
import { estimatePodcastCredits } from './pricing.service';
import { buildScriptCritiquePrompt, generateEpisodeTitlePrompt, generatePodcastScript, getScriptCharacterCount, parseRevisedScript } from './script-generator.service';

// ============================================================================
// TYPES
// ============================================================================

const _TriggerPodcastInputSchema = z.object({
  /** ElevenLabs API key */
  elevenLabsApiKey: z.string(),
  /** Environment bindings for LLM calls (episode title, language detection) */
  env: z.custom<ApiEnv['Bindings']>(),
  /** R2 bucket for audio storage */
  r2Bucket: z.custom<R2Bucket>(),
  /** Round number that just completed */
  roundNumber: z.number(),
  /** Thread ID that completed the round */
  threadId: z.string(),
  /** User who owns the thread */
  userId: z.string(),
});

type TriggerPodcastInput = z.infer<typeof _TriggerPodcastInputSchema>;

/**
 * Map detected language names to ElevenLabs BCP-47 language codes.
 * Falls back to 'en' for unmapped languages.
 */
const LANGUAGE_TO_BCP47 = {
  'Bengali': 'bn',
  'Chinese': 'zh',
  'Dutch': 'nl',
  'French': 'fr',
  'Georgian': 'ka',
  'German': 'de',
  'Greek': 'el',
  'Hebrew': 'he',
  'Hindi': 'hi',
  'Indonesian': 'id',
  'Italian': 'it',
  'Japanese': 'ja',
  'Korean': 'ko',
  'Malay': 'ms',
  'Persian/Farsi': 'fa',
  'Polish': 'pl',
  'Portuguese': 'pt',
  'Romanian': 'ro',
  'Russian': 'ru',
  'Spanish': 'es',
  'Swahili': 'sw',
  'Tamil': 'ta',
  'Thai': 'th',
  'Turkish': 'tr',
  'Vietnamese': 'vi',
} as const;

/** Type-safe Map for BCP-47 lookup with arbitrary string keys. */
const BCP47_MAP = new Map(Object.entries(LANGUAGE_TO_BCP47));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build the R2 storage key for a podcast audio file.
 */
function buildAudioR2Key(threadId: string, podcastId: string): string {
  return `podcasts/${threadId}/${podcastId}.mp3`;
}

const TextPartSchema = z.object({
  text: z.string(),
  type: z.literal('text'),
});

/**
 * Extract plain text from AI SDK message parts array.
 * Uses Zod safeParse instead of manual type guards.
 */
function extractTextFromParts(parts: DbMessageParts): string {
  return parts
    .map(p => TextPartSchema.safeParse(p))
    .filter(r => r.success)
    .map(r => r.data.text)
    .join('\n');
}

/**
 * Mark a podcast as failed with an error message.
 */
async function markPodcastFailed(podcastId: string, errorMessage: string): Promise<void> {
  const db = await getDbAsync();
  await db.update(tables.chatPodcast)
    .set({
      errorMessage,
      status: PodcastStatuses.FAILED,
      updatedAt: new Date(),
    })
    .where(eq(tables.chatPodcast.id, podcastId));
}

/**
 * Update podcast generation progress (0-100).
 */
async function updateProgress(podcastId: string, progress: number): Promise<void> {
  const db = await getDbAsync();
  await db.update(tables.chatPodcast)
    .set({ progress, updatedAt: new Date() })
    .where(eq(tables.chatPodcast.id, podcastId));
}

// ============================================================================
// TRIGGER
// ============================================================================

/**
 * Auto-generate a podcast episode for a completed round.
 *
 * Steps:
 * 1. Check if a podcast already exists for this thread+round (skip if completed)
 * 2. Insert PENDING podcast record immediately (gives frontend something to poll)
 * 3. Generate script → update to GENERATING_SCRIPT
 * 4. Generate audio → update to GENERATING_AUDIO
 * 5. Upload audio to R2
 * 6. Mark COMPLETED
 *
 * On failure: mark FAILED with error, then re-throw for queue retries.
 */
export async function triggerPodcastGeneration(input: TriggerPodcastInput): Promise<void> {
  const { elevenLabsApiKey, env, r2Bucket, roundNumber, threadId, userId } = input;

  const db = await getDbAsync();

  // 1. Check for existing podcast for this thread+round
  const existing = await db.query.chatPodcast.findFirst({
    where: and(
      eq(tables.chatPodcast.threadId, threadId),
      eq(tables.chatPodcast.scope, PodcastScopes.ROUND),
      eq(tables.chatPodcast.roundNumber, roundNumber),
    ),
  });

  if (existing && existing.status !== PodcastStatuses.FAILED) {
    log.info('[PODCAST_TRIGGER] Podcast already exists, skipping', {
      podcastId: existing.id,
      roundNumber,
      status: existing.status,
      threadId,
    });
    return;
  }

  // 2. Create or reset podcast record as PENDING
  const podcastId = existing?.id ?? ulid();
  const now = new Date();

  if (existing) {
    // Delete old R2 audio object if it exists (non-blocking)
    if (existing.audioR2Key) {
      deleteFile(r2Bucket, existing.audioR2Key).catch((err) => {
        log.warn('[PODCAST_TRIGGER] Failed to delete old R2 audio', {
          error: err instanceof Error ? err.message : String(err),
          r2Key: existing.audioR2Key,
        });
      });
    }

    // Full field reset — clear ALL stale data from previous attempt
    await db.update(tables.chatPodcast)
      .set({
        audioDurationMs: null,
        audioR2Key: null,
        audioSizeBytes: null,
        characterCount: null,
        completedAt: null,
        creditsUsed: null,
        episodeTitle: null,
        errorMessage: null,
        progress: 0,
        scriptData: null,
        status: PodcastStatuses.PENDING,
        updatedAt: now,
      })
      .where(eq(tables.chatPodcast.id, podcastId));
  } else {
    const episodeNumber = roundNumber + 1;
    await db.insert(tables.chatPodcast).values({
      createdAt: now,
      episodeNumber,
      id: podcastId,
      roundNumber,
      scope: PodcastScopes.ROUND,
      status: PodcastStatuses.PENDING,
      threadId,
      updatedAt: now,
      userId,
    });
  }

  try {
    // 3. Fetch thread + messages + participants
    const thread = await db.query.chatThread.findFirst({
      where: eq(tables.chatThread.id, threadId),
    });

    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const [messages, participants, priorPodcasts, userMessage, preSearchRecord, moderatorMessage] = await Promise.all([
      db.query.chatMessage.findMany({
        orderBy: tables.chatMessage.createdAt,
        where: and(
          eq(tables.chatMessage.threadId, threadId),
          eq(tables.chatMessage.role, 'assistant'),
          eq(tables.chatMessage.roundNumber, roundNumber),
        ),
      }),
      db.query.chatParticipant.findMany({
        where: eq(tables.chatParticipant.threadId, threadId),
      }),
      db.query.chatPodcast.findMany({
        orderBy: tables.chatPodcast.roundNumber,
        where: and(
          eq(tables.chatPodcast.threadId, threadId),
          eq(tables.chatPodcast.scope, PodcastScopes.ROUND),
          eq(tables.chatPodcast.status, PodcastStatuses.COMPLETED),
        ),
      }),
      db.query.chatMessage.findFirst({
        where: and(
          eq(tables.chatMessage.threadId, threadId),
          eq(tables.chatMessage.role, 'user'),
          eq(tables.chatMessage.roundNumber, roundNumber),
        ),
      }),
      db.query.chatPreSearch.findFirst({
        where: and(
          eq(tables.chatPreSearch.threadId, threadId),
          eq(tables.chatPreSearch.roundNumber, roundNumber),
        ),
      }),
      // Council moderator's synthesis message (participantId is null for moderator)
      db.query.chatMessage.findFirst({
        orderBy: desc(tables.chatMessage.createdAt),
        where: and(
          eq(tables.chatMessage.threadId, threadId),
          eq(tables.chatMessage.role, 'assistant'),
          eq(tables.chatMessage.roundNumber, roundNumber),
          isNull(tables.chatMessage.participantId),
        ),
      }),
    ]);

    if (messages.length === 0) {
      throw new Error(`No messages for round ${roundNumber}`);
    }

    // Generate one-word episode title via LLM
    let episodeTitle: string | null = null;
    try {
      initializeOpenRouter(env as Parameters<typeof initializeOpenRouter>[0]);
      const userPromptText = userMessage ? extractTextFromParts(userMessage.parts) : thread.title;
      const titlePrompt = generateEpisodeTitlePrompt(userPromptText, thread.title, roundNumber);
      const titleResult = await openRouterService.generateText({
        maxTokens: 10,
        messages: [
          {
            id: 'msg-ep-title',
            parts: [{ text: titlePrompt, type: MessagePartTypes.TEXT }],
            role: UIMessageRoles.USER,
          },
        ],
        modelId: TITLE_GENERATION_MODEL_ID,
        system: 'You generate single-word podcast episode titles.',
        temperature: 0.8,
        traceContext: { distinctId: userId, operation: 'episode-title', threadId },
      });
      episodeTitle = titleResult.text.trim().replace(/[^a-z]/gi, '') || null;
    } catch (titleError) {
      log.warn('[PODCAST_TRIGGER] Episode title generation failed, continuing without', {
        error: titleError instanceof Error ? titleError.message : String(titleError),
      });
    }

    // 4. Update to GENERATING_SCRIPT
    await db.update(tables.chatPodcast)
      .set({ episodeTitle, progress: 5, status: PodcastStatuses.GENERATING_SCRIPT, updatedAt: new Date() })
      .where(eq(tables.chatPodcast.id, podcastId));

    const episodeNumber = roundNumber + 1;

    // Build pre-search data if available
    const preSearchData = preSearchRecord?.searchData
      ? {
          queries: preSearchRecord.searchData.queries.map(q => ({ query: q.query, rationale: q.rationale })),
          summary: preSearchRecord.searchData.summary,
          totalResults: preSearchRecord.searchData.totalResults,
        }
      : undefined;

    // Extract council moderator's synthesis content if available
    const moderatorSynthesis = moderatorMessage
      ? extractTextFromParts(moderatorMessage.parts)
      : undefined;

    const script = generatePodcastScript({
      messages: messages.map(m => ({
        content: extractTextFromParts(m.parts),
        participantId: m.participantId,
        role: m.role,
        roundNumber: m.roundNumber,
      })),
      mode: thread.mode,
      moderatorSynthesis: moderatorSynthesis || undefined,
      participants: participants.map(p => ({
        id: p.id,
        modelId: p.modelId,
        role: p.role,
      })),
      preSearchData,
      priorRoundCount: priorPodcasts.length,
      threadTitle: thread.title,
      userPrompt: userMessage ? extractTextFromParts(userMessage.parts) : undefined,
    });

    // Optional: LLM script critique for improved naturalness
    let finalScript = script;
    try {
      const critiquePrompt = buildScriptCritiquePrompt(script);
      const critiqueResult = await openRouterService.generateText({
        maxTokens: 4000,
        messages: [
          {
            id: 'msg-critique',
            parts: [{ text: critiquePrompt, type: MessagePartTypes.TEXT }],
            role: UIMessageRoles.USER,
          },
        ],
        modelId: TITLE_GENERATION_MODEL_ID,
        system: 'You are a podcast script editor. Return only the revised script lines.',
        temperature: 0.3,
        traceContext: { distinctId: userId, operation: 'script-critique', threadId },
      });
      finalScript = parseRevisedScript(script, critiqueResult.text);
      log.info('[PODCAST_TRIGGER] Script critique applied', {
        originalLines: script.lines.length,
        revisedLines: finalScript.lines.length,
      });
    } catch (critiqueError) {
      log.warn('[PODCAST_TRIGGER] Script critique failed, using original', {
        error: critiqueError instanceof Error ? critiqueError.message : String(critiqueError),
      });
      // Fall through with original script
    }

    const characterCount = getScriptCharacterCount(finalScript);
    const estimate = estimatePodcastCredits(characterCount, false);

    // Guard: skip credit deduction if already charged (retry scenario)
    // Read fresh DB state — `existing` snapshot is stale after full reset
    const freshPodcast = await db.query.chatPodcast.findFirst({
      where: eq(tables.chatPodcast.id, podcastId),
    });
    const alreadyCharged = freshPodcast?.creditsUsed !== null && freshPodcast?.creditsUsed !== undefined && freshPodcast.creditsUsed > 0;

    // 5. Update to GENERATING_AUDIO with script data (credits stored after successful upload)
    const generationStartedAt = new Date();
    await db.update(tables.chatPodcast)
      .set({
        characterCount,
        episodeNumber,
        progress: 10,
        scriptData: finalScript,
        status: PodcastStatuses.GENERATING_AUDIO,
        updatedAt: generationStartedAt,
      })
      .where(eq(tables.chatPodcast.id, podcastId));

    // 6. Detect language from user prompt for correct ElevenLabs pronunciation
    let languageCode = 'en';
    const userPromptText = userMessage ? extractTextFromParts(userMessage.parts) : '';
    if (userPromptText) {
      try {
        const detected = await detectLanguage(userPromptText, env);
        if (detected) {
          languageCode = BCP47_MAP.get(detected) ?? 'en';
        }
      } catch {
        // Non-blocking — fall back to English
      }
    }

    // 7. Generate audio
    // Estimate expected bytes for byte-level progress: ~1100 bytes per character (128kbps @ ~15 chars/sec)
    const estimatedTotalBytes = characterCount * 1100;
    let lastReportedProgress = 10;

    const onChunkProgress = async (completed: number, total: number, cumulativeBuffer: ArrayBuffer) => {
      const audioProgress = Math.round(10 + (completed / total) * 80);
      lastReportedProgress = audioProgress;
      await updateProgress(podcastId, audioProgress);

      // Upload cumulative buffer to R2 for progressive playback
      const partialR2Key = buildAudioR2Key(threadId, podcastId);
      const partialDurationMs = Math.round((cumulativeBuffer.byteLength / 16_000) * 1000);
      await putFile(r2Bucket, partialR2Key, cumulativeBuffer, { contentType: 'audio/mpeg' }).catch((err) => {
        log.warn('[PODCAST_TRIGGER] Partial R2 upload failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
      await db.update(tables.chatPodcast)
        .set({
          audioDurationMs: partialDurationMs,
          audioR2Key: partialR2Key,
          audioSizeBytes: cumulativeBuffer.byteLength,
          updatedAt: new Date(),
        })
        .where(eq(tables.chatPodcast.id, podcastId))
        .catch(() => {});
    };

    let lastR2UploadProgress = 10;
    let lastR2UploadTime = 0;

    const onStreamProgress = async (params: { chunkIndex: number; getCumulativeBuffer: () => ArrayBuffer; receivedBytes: number; totalChunks: number }) => {
      const completedChunksFraction = params.chunkIndex / params.totalChunks;
      const currentChunkFraction = estimatedTotalBytes > 0
        ? Math.min(params.receivedBytes / (estimatedTotalBytes / params.totalChunks), 1)
        : 0;
      const overallFraction = completedChunksFraction + (currentChunkFraction / params.totalChunks);
      const streamProgress = Math.round(10 + overallFraction * 80);

      // Gate DB writes: only update if progress increased by ≥1%
      if (streamProgress - lastReportedProgress >= 1) {
        lastReportedProgress = streamProgress;
        await updateProgress(podcastId, streamProgress);
      }

      // Upload partial audio to R2 every ~4% for progressive playback (debounced to 3s)
      const now = Date.now();
      if (streamProgress - lastR2UploadProgress >= 4 && now - lastR2UploadTime >= 3000) {
        lastR2UploadProgress = streamProgress;
        lastR2UploadTime = now;
        const cumulativeBuffer = params.getCumulativeBuffer();
        const partialR2Key = buildAudioR2Key(threadId, podcastId);
        const partialDurationMs = Math.round((cumulativeBuffer.byteLength / 16_000) * 1000);
        await putFile(r2Bucket, partialR2Key, cumulativeBuffer, { contentType: 'audio/mpeg' }).catch(() => {});
        await db.update(tables.chatPodcast)
          .set({
            audioDurationMs: partialDurationMs,
            audioR2Key: partialR2Key,
            audioSizeBytes: cumulativeBuffer.byteLength,
            updatedAt: new Date(),
          })
          .where(eq(tables.chatPodcast.id, podcastId))
          .catch(() => {});
      }
    };

    const { audioBuffer, durationMs, lineTimings } = await generatePodcastAudio(finalScript, elevenLabsApiKey, onChunkProgress, languageCode, onStreamProgress, thread.mode);

    // Write per-line timing estimates back onto the script lines
    for (let i = 0; i < finalScript.lines.length && i < lineTimings.length; i++) {
      const line = finalScript.lines[i];
      const timing = lineTimings[i];
      if (line && timing) {
        line.startMs = timing.startMs;
        line.endMs = timing.endMs;
      }
    }

    // Persist enriched scriptData (with timings) before marking COMPLETED
    await db.update(tables.chatPodcast)
      .set({ scriptData: finalScript, updatedAt: new Date() })
      .where(eq(tables.chatPodcast.id, podcastId));

    // 7. Upload to R2
    const r2Key = buildAudioR2Key(threadId, podcastId);
    const uploadResult = await putFile(r2Bucket, r2Key, audioBuffer, {
      contentType: 'audio/mpeg',
    });

    if (!uploadResult.success) {
      throw new Error(`R2 upload failed: ${uploadResult.error}`);
    }

    // Deduct credits AFTER successful upload to avoid double-charge on retry
    if (!alreadyCharged) {
      await deductCreditsForAction(userId, 'podcastGeneration', {
        description: `Auto podcast R${roundNumber}: ${estimate.credits} credits (${characterCount} chars)`,
        threadId,
      });
    }

    await updateProgress(podcastId, 95);

    // 8. Mark COMPLETED
    const completedAt = new Date();
    await db.update(tables.chatPodcast)
      .set({
        audioDurationMs: durationMs,
        audioR2Key: r2Key,
        audioSizeBytes: audioBuffer.byteLength,
        completedAt,
        creditsUsed: estimate.credits,
        progress: 100,
        status: PodcastStatuses.COMPLETED,
        updatedAt: completedAt,
      })
      .where(eq(tables.chatPodcast.id, podcastId));

    log.info('[PODCAST_TRIGGER] Auto-generation completed', {
      durationMs,
      episodeNumber,
      podcastId,
      roundNumber,
      sizeBytes: audioBuffer.byteLength,
      threadId,
    });

    // Invalidate public thread cache so the Listen button appears immediately
    // on public pages without waiting for ISR cache expiry
    if (thread.isPublic && thread.slug) {
      await invalidatePublicThreadCache(db, thread.slug, threadId).catch((err) => {
        log.warn('[PODCAST_TRIGGER] Failed to invalidate public thread cache', {
          error: err instanceof Error ? err.message : String(err),
          slug: thread.slug,
          threadId,
        });
      });
    }
  } catch (error) {
    // Mark as FAILED, then re-throw for queue retry
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markPodcastFailed(podcastId, errorMessage).catch((markErr) => {
      log.error('[PODCAST_TRIGGER] Failed to mark podcast as failed', {
        error: markErr instanceof Error ? markErr.message : String(markErr),
        podcastId,
      });
    });

    log.error('[PODCAST_TRIGGER] Auto-generation failed', {
      error: errorMessage,
      podcastId,
      roundNumber,
      threadId,
      userId,
    });

    throw error;
  }
}
