/**
 * Unified Round Stream Routes
 *
 * OpenAPI route definitions for unified round streaming (start/resume).
 * Follows backend-patterns.md: 3-file route pattern (route + handler + schema).
 *
 * Routes:
 * - POST /chat/threads/{threadId}/rounds/{roundNumber}/unified-stream - Start unified stream
 * - GET /chat/threads/{threadId}/rounds/{roundNumber}/unified-stream - Resume unified stream
 *
 * @module api/routes/chat/unified-round-stream.route
 */

import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { createMutationRouteResponses, createProtectedRouteResponses, StandardApiResponses } from '@/core';

import {
  StartUnifiedRoundStreamRequestSchema,
  UnifiedRoundStreamParamsSchema,
  UnifiedRoundStreamQuerySchema,
} from './unified-round-stream.schema';

// ============================================================================
// POST - START UNIFIED ROUND STREAM
// ============================================================================

/**
 * POST /chat/threads/{threadId}/rounds/{roundNumber}/unified-stream
 *
 * Starts a unified round stream that executes all phases inline:
 * presearch -> participants (sequential) -> moderator
 *
 * Returns SSE stream with unified event format.
 */
export const startUnifiedRoundStreamRoute = createRoute({
  description: `**Start Unified Round Stream (SSE)**

Executes an entire round inline with a single SSE connection:
1. **Pre-search phase** (optional): Web search for context
2. **Participant phases** (sequential): Each AI model responds in order
3. **Moderator phase** (if 2+ participants): Synthesizes responses

## SSE Event Format

All events use unified format with global sequence numbers:
\`\`\`
event: {type}
id: {sequence}
data: {json}
\`\`\`

## Event Types

- **phase-start**: Phase beginning (presearch/participant/moderator)
- **phase-complete**: Phase finished successfully
- **phase-error**: Phase failed with error
- **text-delta**: Incremental text content
- **finish**: Generation complete with usage stats
- **round-complete**: All phases finished

## Example Events

\`\`\`
event: phase-start
id: 1
data: {"type":"phase-start","phase":"presearch","timestamp":"..."}

event: phase-start
id: 5
data: {"type":"phase-start","phase":"participant","participantId":"p1","participantIndex":0,"totalParticipants":2}

event: text-delta
id: 6
data: {"type":"text-delta","phase":"participant","participantId":"p1","content":"The"}

event: finish
id: 50
data: {"type":"finish","phase":"participant","participantId":"p1","finishReason":"stop","usage":{...}}

event: round-complete
id: 100
data: {"type":"round-complete","roundId":"thread_123:r0","completedPhases":["presearch","participant","moderator"]}
\`\`\`

## Resumption

If connection drops, use GET to resume via the resumable-stream package.
The client's \`useChat({ resume: true })\` handles reconnection automatically.`,
  method: 'post',
  path: '/chat/threads/{threadId}/rounds/{roundNumber}/unified-stream',
  request: {
    body: {
      content: {
        'application/json': {
          schema: StartUnifiedRoundStreamRequestSchema,
        },
      },
      required: true,
    },
    params: UnifiedRoundStreamParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'text/event-stream; charset=utf-8': {
          // Justified z.any(): SSE streams have dynamic format with multiple event types
          // (phase-start, text-delta, finish, round-complete, etc.)
          // Cannot be represented with single static Zod schema
          schema: z.any().openapi({
            description: 'Unified round stream SSE format. Events: phase-start, phase-complete, phase-error, text-delta, finish, round-complete. Resumption handled by resumable-stream package via GET endpoint.',
            example: 'event: phase-start\nid: 1\ndata: {"type":"phase-start","phase":"presearch"}\n\nevent: text-delta\nid: 10\ndata: {"type":"text-delta","phase":"participant","content":"Hello"}\n\n',
          }),
        },
      },
      description: 'Unified round stream started - SSE with phase events and text deltas',
    },
    ...createMutationRouteResponses(),
    // 409 when another live producer already owns this round's stream (a
    // concurrent duplicate start) — the client should resume, not double-stream.
    ...StandardApiResponses.CONFLICT,
  },
  summary: 'Start unified round stream (presearch -> participants -> moderator)',
  tags: ['chat'],
});

// ============================================================================
// GET - RESUME UNIFIED ROUND STREAM
// ============================================================================

/**
 * GET /chat/threads/{threadId}/rounds/{roundNumber}/unified-stream
 *
 * Resumes a unified round stream using the resumable-stream package.
 * Returns buffered SSE data from Redis if stream is still active.
 */
export const resumeUnifiedRoundStreamRoute = createRoute({
  description: `**Resume Unified Round Stream (SSE)**

Resumes an active unified round stream using the resumable-stream package.
Buffered SSE data is replayed from Redis; the client handles deduplication.

## Response Scenarios

1. **Active stream**: Returns SSE stream with buffered data, then live events
2. **Completed stream**: Returns 204 No Content (stream fully consumed)
3. **No active stream**: Returns 204 No Content (not found or expired)

## Response Headers

- **X-Stream-Id**: Stream identifier
- **X-Round-Number**: Round number

## Usage Pattern

1. Client connects with POST to start stream
2. If connection drops, client reconnects with GET (no query params)
3. resumable-stream replays buffered data and continues with live events
4. Called automatically by \`useChat({ resume: true })\` on mount

## Example

\`\`\`
GET /chat/threads/thread_123/rounds/0/unified-stream
\`\`\``,
  method: 'get',
  path: '/chat/threads/{threadId}/rounds/{roundNumber}/unified-stream',
  request: {
    params: UnifiedRoundStreamParamsSchema,
    query: UnifiedRoundStreamQuerySchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'No active unified stream for this thread/round',
    },
    [HttpStatusCodes.OK]: {
      content: {
        'text/event-stream; charset=utf-8': {
          // Justified z.any(): Same SSE format as start route
          schema: z.any().openapi({
            description: 'Resumed unified round stream SSE via resumable-stream. Replays buffered data, then live events.',
          }),
        },
      },
      description: 'Stream resumed - returning buffered and/or live SSE events',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Resume unified round stream (replays all data from beginning)',
  tags: ['chat'],
});
