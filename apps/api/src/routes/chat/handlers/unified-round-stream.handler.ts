/**
 * Unified Round Stream Handlers
 *
 * Handlers for starting and resuming unified round streams.
 * Follows backend-patterns.md: Domain-specific handler module.
 *
 * KEY ARCHITECTURE:
 * - Uses AI SDK v6 streamText for participant/moderator generation
 * - Single SSE connection for entire round (presearch -> participants -> moderator)
 * - AI SDK v6 stream resumption via resumable-stream package (official pattern)
 * - Active stream tracking via active-stream-db.service (D1)
 * - Participants fetched from DB (not required in request body)
 *
 * RESUMPTION PATTERN (AI SDK v6 + resumable-stream):
 * - POST: Uses consumeSseStream callback with streamContext.createNewResumableStream
 *   to buffer SSE to Redis via waitUntil (Cloudflare Workers equivalent of Next.js 'after')
 * - GET: Uses streamContext.resumeExistingStream to replay buffered SSE data
 *   Returns null (completed), undefined (not found), or ReadableStream<string> (active)
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
 * @module api/routes/chat/handlers/unified-round-stream.handler
 */

import type { RouteHandler } from '@hono/zod-openapi';
import { EntityPhases, MessageRoles, ThreadVerticalMetadataSchema, UserRoles } from '@debatekit/shared/enums';
import { createUIMessageStreamResponse, generateId, UI_MESSAGE_STREAM_HEADERS } from 'ai';
import { and, desc, eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createHandler } from '@/core';
import { getDbAsync } from '@/db';
import * as tables from '@/db';
import { DbMessagePartsSchema } from '@/db/schemas/chat-metadata';
import { extractSessionToken } from '@/lib/auth';
import { log } from '@/lib/logger';
import { getResumableStreamContext } from '@/lib/resumable-stream-upstash';
import { getEnabledParticipants } from '@/services/participants/participant-query.service';
import {
  clearActiveStream,
  getUnifiedStream,
  initUnifiedStreamBuffer,
  setActiveStream,
  UNIFIED_ENTITY_INDEX,
} from '@/services/streaming';
import type { UnifiedParticipant } from '@/services/streaming/unified-stream-orchestration.service';
import { executeUnifiedRoundStream } from '@/services/streaming/unified-stream-orchestration.service';
import { getUserTier } from '@/services/usage';
import type { ApiEnv } from '@/types';

import type {
  resumeUnifiedRoundStreamRoute,
  startUnifiedRoundStreamRoute,
} from '../unified-round-stream.route';
import type { AiSdkMessage } from '../unified-round-stream.schema';
import {
  StartUnifiedRoundStreamRequestSchema,
  UnifiedRoundStreamParamsSchema,
  UnifiedRoundStreamQuerySchema,
} from '../unified-round-stream.schema';

// ============================================================================
// UNIFIED SSE HEADERS
// ============================================================================

/**
 * Custom headers for unified round stream
 * Added to AI SDK's createUIMessageStreamResponse headers
 */
const UNIFIED_STREAM_CUSTOM_HEADERS = {
  'X-Vercel-AI-UI-Message-Stream': 'v1',
} as const;

// UNIFIED_ENTITY_INDEX imported from @/services/streaming

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract text content from AI SDK v6 message format.
 *
 * AI SDK v6 uses parts array instead of content property.
 * Per migration guide: https://github.com/vercel/ai/blob/main/content/docs/08-migration-guides/26-migration-guide-5-0.mdx
 */
function extractUserMessageText(message: AiSdkMessage): string {
  // AI SDK v6 uses parts array
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

/**
 * Helper to clear D1 active stream record for unified streams.
 */
function clearUnifiedActiveStream(db: Awaited<ReturnType<typeof getDbAsync>>, threadId: string, roundNumber: number) {
  return clearActiveStream(db, {
    entityIndex: UNIFIED_ENTITY_INDEX,
    entityType: EntityPhases.UNIFIED,
    roundNumber,
    threadId,
  });
}

// ============================================================================
// START UNIFIED ROUND STREAM HANDLER
// ============================================================================

/**
 * POST /chat/threads/{threadId}/rounds/{roundNumber}/unified-stream
 *
 * Starts a unified round stream executing all phases inline.
 * Integrates with Redis for buffering and D1 for active stream tracking.
 */
export const startUnifiedRoundStreamHandler: RouteHandler<
  typeof startUnifiedRoundStreamRoute,
  ApiEnv
> = createHandler(
  {
    auth: 'session-or-internal',
    operationName: 'startUnifiedRoundStream',
    validateBody: StartUnifiedRoundStreamRequestSchema,
    validateParams: UnifiedRoundStreamParamsSchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { roundNumber: roundNumberStr, threadId } = c.validated.params;
    const body = c.validated.body;

    const roundNumber = Number.parseInt(roundNumberStr, 10);
    if (Number.isNaN(roundNumber) || roundNumber < 0) {
      return c.json({ error: 'Invalid round number', success: false }, HttpStatusCodes.BAD_REQUEST);
    }
    const roundId = `${threadId}:r${roundNumber}`;
    const db = await getDbAsync();

    // Extract user message text from AI SDK message format
    // Falls back to DB lookup when request body has empty text (e.g., queue consumer triggers)
    let userMessage = extractUserMessageText(body.message);
    if (!userMessage.trim()) {
      const dbUserMessage = await db.query.chatMessage.findFirst({
        columns: { parts: true },
        orderBy: desc(tables.chatMessage.createdAt),
        where: and(
          eq(tables.chatMessage.threadId, threadId),
          eq(tables.chatMessage.roundNumber, roundNumber),
          eq(tables.chatMessage.role, MessageRoles.USER),
        ),
      });
      const parsedParts = DbMessagePartsSchema.safeParse(dbUserMessage?.parts);
      if (parsedParts.success) {
        userMessage = parsedParts.data
          .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
          .map(p => p.text)
          .join('\n');
      }
    }

    // Fetch thread settings (enableWebSearch, mode, projectId, etc.) from database
    const thread = await db.query.chatThread.findFirst({
      where: eq(tables.chatThread.id, threadId),
      columns: { enablePodcast: true, enableWebSearch: true, id: true, metadata: true, mode: true, projectId: true },
    });

    if (!thread) {
      log.warn('Thread not found', { threadId, userId: user.id });
      return c.json({ error: 'Thread not found' }, HttpStatusCodes.NOT_FOUND);
    }

    // =========================================================================
    // ROUND NUMBER VALIDATION
    // =========================================================================
    // Validate that the client's roundNumber matches the expected round.
    // This prevents race conditions where stale client state sends wrong round.
    //
    // DB is the source of truth:
    // - Query last user message's roundNumber
    // - Check if any assistant messages exist for that round (round is complete)
    // - If no assistant messages: expected = lastRound (round is incomplete)
    // - If assistant messages exist: expected = lastRound + 1 (next round)
    // - Return 400 ROUND_MISMATCH if client sends different round
    //
    // IMPORTANT: Thread creation pre-inserts the user message before streaming,
    // so we need to allow continuing an incomplete round (no assistant responses yet).
    // =========================================================================
    const lastUserMessage = await db.query.chatMessage.findFirst({
      columns: { roundNumber: true },
      orderBy: desc(tables.chatMessage.roundNumber),
      where: and(
        eq(tables.chatMessage.threadId, threadId),
        eq(tables.chatMessage.role, MessageRoles.USER),
      ),
    });

    const lastRound = lastUserMessage?.roundNumber ?? -1;

    // Check if there are any assistant messages for the last user message's round
    // If not, the round is incomplete and we allow streaming for that round
    let expectedRound: number;
    if (lastRound >= 0) {
      const assistantInRound = await db.query.chatMessage.findFirst({
        columns: { id: true },
        where: and(
          eq(tables.chatMessage.threadId, threadId),
          eq(tables.chatMessage.role, MessageRoles.ASSISTANT),
          eq(tables.chatMessage.roundNumber, lastRound),
        ),
      });
      // If no assistant messages in the last round, it's incomplete - allow that round
      // If assistant messages exist, the round is complete - expect next round
      expectedRound = assistantInRound ? lastRound + 1 : lastRound;
    } else {
      // No user messages yet - expect round 0
      expectedRound = 0;
    }

    if (roundNumber !== expectedRound) {
      log.warn('Round number mismatch', {
        expected: expectedRound,
        lastStoredRound: lastRound,
        received: roundNumber,
        threadId,
        userId: user.id,
      });
      return c.json(
        {
          error: 'ROUND_MISMATCH',
          expected: expectedRound,
          message: `Client round ${roundNumber} does not match expected ${expectedRound}. Please refresh messages.`,
          received: roundNumber,
        },
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    // Fetch enabled participants from database
    const participantRecords = await getEnabledParticipants(threadId, db);

    if (participantRecords.length === 0) {
      log.warn('No enabled participants found for thread', {
        roundNumber,
        threadId,
        userId: user.id,
      });
      return c.json(
        { error: 'No enabled participants found for this thread' },
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    // Get enableWebSearch and mode from thread settings (source of truth)
    const enableWebSearch = thread.enableWebSearch;
    const threadMode = thread.mode;

    // Parse thread metadata for vertical preset data (dataSources, moderatorFormat)
    // Moved BEFORE Redis init so hasDataSources can influence includePresearch
    const parsedMetadata = ThreadVerticalMetadataSchema.safeParse(thread.metadata);
    const threadMetadata = parsedMetadata.success ? parsedMetadata.data : null;
    const hasDataSources = (threadMetadata?.dataSources?.length ?? 0) > 0;

    log.info('Starting unified round stream', {
      attachmentCount: body.attachmentIds?.length ?? 0,
      enableWebSearch,
      hasDataSources,
      mode: threadMode,
      participantCount: participantRecords.length,
      roundNumber,
      threadId,
      userId: user.id,
    });

    // Map DB participants to service format (ordered by priority)
    // Include role for V3.0 LLM Council prompt building
    const participants: UnifiedParticipant[] = participantRecords.map((p, index) => ({
      id: p.id,
      index,
      modelId: p.modelId,
      role: p.role,
      systemPrompt: p.settings?.systemPrompt,
    }));

    // Generate unique stream ID for resumption
    // This ID is used to store/retrieve the SSE stream in Redis
    const streamId = generateId();

    // =========================================================================
    // INITIALIZATION: D1 first (source of truth), then Redis
    // =========================================================================
    // Sequential approach prevents asymmetric state: if D1 insert fails,
    // we never initialize Redis. If Redis fails after D1 succeeds, we
    // clean up the D1 record so the client does not see a stale active stream
    // pointing to an uninitialized buffer.
    // Trade-off: Adds ~10-20ms to time-to-first-token but ensures resume works.
    // =========================================================================
    await setActiveStream(db, {
      entityIndex: UNIFIED_ENTITY_INDEX,
      entityType: EntityPhases.UNIFIED,
      roundNumber,
      threadId,
    }, streamId);

    // Redis buffer enables resume support (GET reconnection).
    // If Redis init fails, proceed WITHOUT resume — streaming still works,
    // just without reconnection ability. This prevents Redis outages from
    // killing ALL streams (automated jobs, user chats, web search).
    try {
      await initUnifiedStreamBuffer(
        threadId,
        roundNumber,
        roundId,
        c.env,
        { includePresearch: enableWebSearch || hasDataSources },
      );
    } catch (err) {
      log.error('Redis stream buffer init failed — proceeding without resume support', {
        error: err instanceof Error ? err.message : String(err),
        roundNumber,
        streamId,
        threadId,
      });
      // Clean up D1 active stream record since Redis buffer is unavailable
      // Resume GET would fail anyway, so remove the pointer
      await clearUnifiedActiveStream(db, threadId, roundNumber).catch((clearErr) => {
        log.error('Failed to clear D1 during Redis rollback', {
          error: clearErr instanceof Error ? clearErr.message : String(clearErr),
          roundNumber,
          threadId,
        });
      });
    }

    // Build base URL for citation download links
    const protocol = c.req.header('x-forwarded-proto') || 'https';
    const host = c.req.header('host') || 'api.debatekit.com';
    const baseUrl = `${protocol}://${host}`;

    // Get user's subscription tier for token limits
    // Each participant gets their own full token allowance based on tier
    const userTier = await getUserTier(user.id);

    // Execute unified stream with service
    // Pass mode for V3.0 LLM Council mode-specific prompts
    // Pass db, projectId, baseUrl for citation context building
    // Pass attachmentIds for file context in participant prompts
    // Pass userTier for tier-based token limits
    // threadMetadata already parsed above (before Redis init)
    const stream = await executeUnifiedRoundStream(
      {
        attachmentIds: body.attachmentIds,
        baseUrl,
        db,
        enableWebSearch,
        env: c.env,
        mode: threadMode,
        participants,
        projectId: thread.projectId,
        roundNumber,
        sessionId: user.id,
        threadId,
        threadMetadata,
        userMessage,
        userId: user.id,
        userTier,
      },
      {
        onComplete: async (completedRoundId) => {
          log.info('Unified round stream completed', {
            roundId: completedRoundId,
            roundNumber,
            streamId,
            threadId,
            userId: user.id,
          });

          // Fallback cleanup: Resume GET handler is the primary D1 cleanup path.
          // This delayed cleanup is a safety net for cases where the client
          // never issues a resume GET (e.g., tab close, network failure).
          // Uses waitUntil to survive beyond the response lifecycle on Workers.
          c.executionCtx.waitUntil(
            new Promise<void>((resolve) => {
              setTimeout(resolve, 500);
            }).then(() =>
              clearUnifiedActiveStream(db, threadId, roundNumber).catch((err) => {
                log.error('Fallback D1 cleanup failed', { error: err, roundNumber, threadId });
              }),
            ),
          );

          // Auto-generate podcast episode via queue if enabled on this thread.
          if (thread.enablePodcast && user.role === UserRoles.ADMIN) {
            c.executionCtx.waitUntil(
              c.env.PODCAST_GENERATION_QUEUE.send({
                messageId: `podcast-${threadId}-r${roundNumber}`,
                queuedAt: new Date().toISOString(),
                roundNumber,
                threadId,
                userId: user.id,
              }).catch((err) => {
                log.error('Failed to enqueue podcast generation', {
                  error: err instanceof Error ? err.message : String(err),
                  roundNumber,
                  threadId,
                });
              }),
            );
          }

          // Check if this thread belongs to an automated job and queue continuation.
          // This is the PRIMARY path for job advancement - runs in the same worker
          // that completed the stream, so it's reliable regardless of whether the
          // queue consumer successfully drains the SSE response.
          c.executionCtx.waitUntil(
            (async () => {
              try {
                const sessionToken = extractSessionToken(c.req.header('cookie'));
                if (!sessionToken) {
                  return;
                }
                const { checkJobContinuation } = await import('@/services/jobs');
                await checkJobContinuation(threadId, roundNumber, sessionToken, db, c.env.ROUND_ORCHESTRATION_QUEUE);
              } catch (err) {
                log.error('[JobContinuation] Failed in onComplete callback', {
                  error: err instanceof Error ? err.message : String(err),
                  roundNumber,
                  threadId,
                });
              }
            })(),
          );
        },
        onError: async (error, phase) => {
          log.error('Unified round stream error', {
            error: error.message,
            phase,
            roundNumber,
            streamId,
            threadId,
            userId: user.id,
          });

          // On error, clear D1 record (no point keeping for a failed stream)
          // resumable-stream handles buffer cleanup automatically
          await clearUnifiedActiveStream(db, threadId, roundNumber);
        },
      },
    );

    // =========================================================================
    // STREAM RESUMPTION WITH resumable-stream PACKAGE
    // =========================================================================
    // Uses the official AI SDK v6 resumable-stream pattern:
    // - consumeSseStream receives the SSE string stream (already tee'd by AI SDK)
    // - streamContext.createNewResumableStream buffers to Redis via waitUntil
    // - Handles client disconnect resilience automatically
    // - GET handler uses streamContext.resumeExistingStream to replay
    //
    // @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
    // =========================================================================

    // Get resumable stream context for Upstash Redis + Cloudflare Workers
    const streamContext = await getResumableStreamContext(
      c.env,
      p => c.executionCtx.waitUntil(p),
    );

    // Return AI SDK v6 UIMessageStreamResponse with resumable-stream consumer
    return createUIMessageStreamResponse({
      stream,
      headers: {
        ...UNIFIED_STREAM_CUSTOM_HEADERS,
        'X-Round-Number': String(roundNumber),
        'X-Stream-Id': streamId,
        'X-Total-Participants': String(participants.length),
      },
      status: HttpStatusCodes.OK,
      // resumable-stream: buffer SSE to Redis for resumption via waitUntil
      consumeSseStream: async ({ stream: sseStream }) => {
        await streamContext.createNewResumableStream(streamId, () => sseStream);
      },
    });
  },
);

// ============================================================================
// RESUME UNIFIED ROUND STREAM HANDLER
// ============================================================================

/**
 * GET /chat/threads/{threadId}/rounds/{roundNumber}/unified-stream
 *
 * Resumes a unified round stream using the resumable-stream package.
 *
 * RESUMPTION FLOW (resumable-stream):
 * 1. Check D1 for active stream record (contains streamId)
 * 2. If no active stream, return 204 No Content
 * 3. Use streamContext.resumeExistingStream(streamId) to get buffered data
 *    - Returns null: stream completed (all data consumed)
 *    - Returns undefined: stream not found in Redis
 *    - Returns ReadableStream<string>: active or buffered stream data
 * 4. Return SSE response with AI SDK headers
 *
 * The client's useChat({ resume: true }) automatically calls this endpoint
 * on mount to reconnect to any active stream.
 */
export const resumeUnifiedRoundStreamHandler: RouteHandler<
  typeof resumeUnifiedRoundStreamRoute,
  ApiEnv
> = createHandler(
  {
    auth: 'session-or-internal',
    operationName: 'resumeUnifiedRoundStream',
    validateParams: UnifiedRoundStreamParamsSchema,
    validateQuery: UnifiedRoundStreamQuerySchema,
  },
  async (c) => {
    const { user } = c.auth();
    const { roundNumber: roundNumberStr, threadId } = c.validated.params;

    const roundNumber = Number.parseInt(roundNumberStr, 10);
    if (Number.isNaN(roundNumber) || roundNumber < 0) {
      return c.json({ error: 'Invalid round number', success: false }, HttpStatusCodes.BAD_REQUEST);
    }
    const db = await getDbAsync();

    log.info('Resuming unified round stream', {
      roundNumber,
      threadId,
      userId: user.id,
    });

    // =========================================================================
    // STEP 1: Check D1 for active stream record
    // =========================================================================
    const activeStreamRecord = await getUnifiedStream(db, threadId, roundNumber);

    if (!activeStreamRecord) {
      log.info('No active unified stream found in D1', {
        roundNumber,
        threadId,
      });
      return new Response(null, { status: HttpStatusCodes.NO_CONTENT });
    }

    const { streamId } = activeStreamRecord;

    log.info('Found active stream in D1', {
      roundNumber,
      streamId,
      threadId,
    });

    // =========================================================================
    // STEP 2: Resume via resumable-stream package
    // =========================================================================
    try {
      const streamContext = await getResumableStreamContext(
        c.env,
        p => c.executionCtx.waitUntil(p),
      );

      // Defense-in-depth: timeout guard prevents Worker hang if the producer
      // is gone and resumeExistingStream's internal Promise never resolves.
      // The resumable-stream package has a 1s internal timeout, but it can
      // fail to resolve the outer Promise in edge cases (sentinel not "DONE"
      // but producer expired). The 45s timeout accommodates presearch phase
      // which can take 30+ seconds for web search results before streaming
      // begins. A shorter timeout (e.g. 10s) would cause premature 204
      // responses, making the client think there is no active stream.
      const RESUME_TIMEOUT_MS = 45_000;
      const resumedStream = await Promise.race([
        streamContext.resumeExistingStream(streamId),
        new Promise<undefined>((resolve) => {
          setTimeout(() => resolve(undefined), RESUME_TIMEOUT_MS);
        }),
      ]);

      // null = stream completed (all data already consumed)
      if (resumedStream === null) {
        log.info('Stream completed - clearing D1 record', {
          roundNumber,
          streamId,
          threadId,
        });
        await clearUnifiedActiveStream(db, threadId, roundNumber);
        return new Response(null, { status: HttpStatusCodes.NO_CONTENT });
      }

      // undefined = stream not found in Redis (expired, never existed, or resume timed out)
      if (resumedStream === undefined) {
        log.info('Stream not found in Redis or resume timed out', {
          roundNumber,
          streamId,
          threadId,
        });
        await clearUnifiedActiveStream(db, threadId, roundNumber);
        return new Response(null, { status: HttpStatusCodes.NO_CONTENT });
      }

      log.info('Resuming stream via resumable-stream', {
        roundNumber,
        streamId,
        threadId,
      });

      // =========================================================================
      // STEP 3: Return resumed stream with AI SDK headers
      // =========================================================================
      const encoder = new TextEncoder();
      const transformedStream = resumedStream.pipeThrough(
        new TransformStream<string, Uint8Array>({
          transform(chunk, controller) {
            controller.enqueue(encoder.encode(chunk));
          },
        }),
      );

      return new Response(transformedStream, {
        headers: {
          ...UI_MESSAGE_STREAM_HEADERS,
          'X-Round-Number': String(roundNumber),
          'X-Stream-Id': streamId,
        },
        status: HttpStatusCodes.OK,
      });
    } catch (error) {
      log.error('Error resuming stream', {
        error: error instanceof Error ? error.message : String(error),
        roundNumber,
        streamId,
        threadId,
      });

      // Don't clear D1 record on transient errors - stream may still be active
      return new Response(null, { status: HttpStatusCodes.NO_CONTENT });
    }
  },
);
