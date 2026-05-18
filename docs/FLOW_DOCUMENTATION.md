# DebateKit: Visual Flow & Architecture Documentation

> **Implementation Status**: This document reflects the actual implementation as of February 2026.
> Uses Upstash Redis for stream buffering (SSE buffer + unified round state), Cloudflare KV for pre-search streams only, and D1 for active stream tracking and final message persistence. Follows AI SDK v6 resumable stream patterns.

## Architecture Overview: Backend-First Streaming

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND-FIRST ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────┐          ┌──────────────────────────────────────┐    │
│   │     FRONTEND     │          │              BACKEND                 │    │
│   │   (Subscriber)   │          │    (Orchestrator / Publisher)        │    │
│   └────────┬─────────┘          └──────────────────┬───────────────────┘    │
│            │                                       │                         │
│            │  POST /unified-stream                 │                         │
│            │ ─────────────────────────────────────>│                         │
│            │   "Start round with user message"     │                         │
│            │                                       │                         │
│            │  200 + SSE (single unified stream)    │                         │
│            │ <═════════════════════════════════════│                         │
│            │                                       │                         │
│            │                           ┌───────────┴───────────┐             │
│            │                           │  Round Orchestrator   │             │
│            │  Phases merged into       │  (inline + waitUntil) │             │
│            │  single SSE connection:   │                       │             │
│            │  1. Web Research          │  1. Web Research      │             │
│            │  2. P0 → P1 → P2         │  2. P0 → P1 → P2      │             │
│            │  3. Moderator             │  3. Moderator         │             │
│            │                           └───────────┬───────────┘             │
│            │                                       │                         │
│            │  On disconnect/reload:                │  Buffers to Redis:      │
│            │  GET /unified-stream (resume)         │  SSE: sse:{sid}:data    │
│            │ ─────────────────────────────────────>│  State: unified:...:meta│
│            │                                       │  D1: active_stream      │
│            │  200 + replayed SSE (or 204)          │                         │
│            │ <═════════════════════════════════════│                         │
│            │                                       │                         │
└─────────────────────────────────────────────────────────────────────────────┘

KEY PRINCIPLE: Frontend NEVER decides what happens next.
               Frontend ONLY subscribes and displays.
               Single unified SSE stream per round (not per-entity).
```

---

## Storage Architecture: Redis + KV + D1

### Stream Buffering (Three Layers)

```
LAYER 1: SSE Buffer (Upstash Redis via `resumable-stream` package)
  Managed by: `resumable-stream` npm package (internal Redis keys)
  Purpose: AI SDK v6 resume pattern - raw SSE replay on GET reconnection
  Used by: resumeUnifiedRoundStreamHandler (GET endpoint)

  NOTE: The SSE buffer is managed by the `resumable-stream` npm package
  (via `getResumableStreamContext()`), not manually via Redis RPUSH/HSET.
  The key patterns described below (sse:{streamId}:data, sse:{streamId}:meta)
  are the internal implementation of `resumable-stream`.

LAYER 2: Unified Round State (Upstash Redis - SSR Hydration)
  Key: unified:{threadId}:r{roundNumber}:chunks   # Redis list of typed chunks (RPUSH)
  Key: unified:{threadId}:r{roundNumber}:meta      # Redis hash: globalSeq, currentPhase, phaseStatuses
  Purpose: Structured round state for route loaders and SSR hydration
  Used by: Route loaders to populate Zustand store on page load/navigation

LAYER 3: Pre-Search Buffer (Cloudflare KV - Pre-search only)
  Key: stream:buffer:{streamId}:meta       # KV: pre-search metadata
  Key: stream:buffer:{streamId}:c:{index}  # KV: individual chunks (separate keys)
  Purpose: Pre-search stream chunks (optional phase, fewer chunks)
  Used by: Pre-search stream handlers

Active Stream Tracking (D1 Database):
  Table: active_stream
  Columns: threadId, roundNumber, entityType, entityIndex, streamId
  Purpose: Maps thread/round to streamId for resume handler lookup
  Lifecycle: Created on POST, cleared by resume handler after serving complete data

SSE Buffer Metadata structure:
NOTE: The exact metadata fields are managed internally by the `resumable-stream` package.
Application code interacts via `createNewResumableStream()` and `resumeExistingStream()`.
The package handles stream completeness tracking, buffer management, and replay internally.

Backend replays ALL SSE data from beginning; AI SDK handles dedup
natively via message-ID-based replaceMessage (rebuilds message, no duplication).
TTL: 1 hour (auto-cleanup of expired streams)
```

**Why Redis lists instead of KV?** Upstash Redis RPUSH is O(1), strongly consistent
(no 100-250ms eventual consistency delay), and LRANGE enables efficient range reads.
Pre-search uses KV because it has fewer chunks and benefits from edge caching.

### Round State Storage (Upstash Redis - Coordination)

```
Redis Hash: unified:{threadId}:r{roundNumber}:meta
(Plus participant statuses: round:{threadId}:{roundNumber}:participants)

Value (RoundExecutionState):
┌─────────────────────────────────────────────────────────────────┐
│  {                                                              │
│    "threadId": "abc123",                                        │
│    "roundNumber": 0,                                            │
│    "status": "pending" | "running" | "completed" | "failed",    │
│                                                                 │
│    // 3-PHASE STATE MACHINE (not 5)                             │
│    "phase": "participants" | "moderator" | "complete",          │
│                                                                 │
│    // Pre-search tracked as STATUS FIELD (not phase)            │
│    "preSearchStatus": "pending" | "running" | "completed" | "failed" | null,
│                                                                 │
│    // Participant tracking                                      │
│    "participantStatuses": {                                     │
│      "0": "pending" | "active" | "completed" | "failed",        │
│      "1": "pending" | "active" | "completed" | "failed"         │
│    },                                                           │
│    "totalParticipants": 2,                                      │
│    "completedParticipants": 1,                                  │
│    "failedParticipants": 0,                                     │
│    "triggeredParticipants": [0],                                │
│                                                                 │
│    // Moderator tracking                                        │
│    "moderatorStatus": "pending" | "active" | "completed" | "failed" | null,
│                                                                 │
│    // Metadata                                                  │
│    "attachmentIds": ["att-1", "att-2"],                         │
│    "startedAt": "2024-01-23T...",                               │
│    "lastActivityAt": "2024-01-23T...",                          │
│    "completedAt": "2024-01-23T..." | null,                      │
│    "error": null | "error message",                             │
│    "recoveryAttempts": 0                                        │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘

DESIGN DECISION: Backend uses 3 phases + presearch status field.
- Pre-search is OPTIONAL and tracked as a STATUS FIELD (not phase)
- Phase only transitions: PARTICIPANTS → MODERATOR → COMPLETE
- Pre-search completion is checked BEFORE phase machine begins

NOTE: The FRONTEND Zustand store uses a 5-phase enum that includes presearch:
  ChatPhaseValues = ['idle', 'presearch', 'participants', 'moderator', 'complete']
  Phase flow: idle → presearch → participants → moderator → complete → idle
  See "Frontend Phase Machine" section below for details.
```

### Final Message Storage (D1 - Durable)

```
D1: chat_message table

When stream completes, full content written to D1:
┌──────────────────────────────────────────────────────────────────┐
│  id: "thread_abc_r0_p0"                                          │
│  thread_id: "abc123"                                             │
│  round_number: 0                                                 │
│  participant_id: "participant_xyz"                               │
│  content: "Hello there! This is my full response..."             │
│  metadata: { participantIndex: 0, model: "gpt-5-nano" }          │
│  created_at: "2024-01-23T..."                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Stream Resumption Pattern

### How Resumption Works

```
                           STREAM RESUMPTION FLOW

USER NAVIGATES AWAY ────────────────────────────────────────► USER RETURNS
        │                                                          │
        │  Backend continues                                       │
        │  writing to Redis                                        │
        │                                                          │
        ▼                                                          ▼
┌──────────────────┐                                    ┌──────────────────┐
│ Redis at leave:  │                                    │  Client reconnect│
│                  │                                    │                  │
│  chunks: [1..15] │     Time passes...                 │  Backend replays │
│  status: stream  │  ════════════════════════════════> │  ALL SSE data    │
│                  │                                    │  from beginning  │
└──────────────────┘                                    └────────┬─────────┘
                                                                 │
        ┌────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────┐
│ Redis now:       │
│                  │
│  chunks: [1..42] │  Client receives all chunks (1-42)
│  status: stream  │  AI SDK deduplicates natively via
│                  │  message-ID-based replaceMessage
└──────────────────┘
```

**Key Architecture Change**: The frontend no longer sends `lastSeq` to the backend. Backend replays all SSE data from the beginning; AI SDK v6 handles dedup natively -- `AbstractChat.makeRequest` with `trigger: "resume-stream"` reuses the existing assistant message by ID and calls `replaceMessage()` instead of `pushMessage()`, so replayed content rebuilds the message from scratch without duplication. Backend is the sole source of truth.

### Subscription Endpoint Pattern

```typescript
// Frontend subscribes to unified stream (no lastSeq parameter)
GET /api/threads/{threadId}/stream

// Backend responds with SSE (replays ALL chunks from beginning)
event: chunk
data: {"seq":1,"text":"Hello","ts":1706000001}

event: chunk
data: {"seq":2,"text":" world","ts":1706000002}

// ... (replays all existing chunks)

event: chunk
data: {"seq":42,"text":" conclusion","ts":1706000042}

event: status
data: {"status":"complete"}
```

**Client-side dedup**: AI SDK v6 handles dedup natively during resume. When `AbstractChat.makeRequest` processes the replayed stream, it rebuilds the assistant message from scratch using the same message ID. The `write()` callback detects that the active response message ID matches the last message ID and calls `replaceMessage()` instead of `pushMessage()`, so no duplicate content accumulates.

---

## How Rounds Work: Turn-Taking System

```
ORDER OF SPEAKING (Top to Bottom):

    1. User Message         ←── Always first (you ask the question)
    2. Web Research         ←── Optional (if enabled, searches before anyone)
    3. Participant 1        ←── First AI speaks
    4. Participant 2        ←── Second AI speaks (after first finishes)
    5. Participant 3        ←── Third AI speaks (after second finishes)
    6. Council Moderator    ←── Always last (summarizes everyone)

THE GOLDEN RULE: Nothing starts until the thing above it finishes.
                 Backend orchestrates. Frontend subscribes.
```

---

## Round 1: First Message Flow (No Web Search)

### Frame 1→2: User Sends → Placeholders Appear

```
┌─────────────────────────────────────────────────────────────────┐
│  SEND CLICKED                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                       ┌─────────────────────────┐                │
│                       │  say hi, 1 word only    │  USER          │
│                       └─────────────────────────┘                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🟢 GPT-5 Nano  •           Thinking...                    │  │  P0
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🔵 DeepSeek V3  •          Thinking...                    │  │  P1
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🌈 Moderator  •            Observing...                   │  │  MOD
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Waiting for AI response...                           ⏹️   │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Backend Actions:
1. POST /rounds/execute received
2. User message saved to D1
3. Round state initialized in Redis (phase: PARTICIPANTS)
4. P0 stream started, chunks written to Redis
5. Frontend subscribes to GET /stream/p0
```

### Frame 3→4: P0 Streams → P1 Starts

```
┌─────────────────────────────────────────────────────────────────┐
│  P0 STREAMING → P0 COMPLETE → P1 STARTS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🟢 GPT-5 Nano              Hello                     📋   │  │  DONE ✓
│  └────────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         │ BATON PASSED                           │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🔵 DeepSeek V3  •          Hi█                            │  │  STREAMING
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🌈 Moderator  •            Observing...                   │  │  WAITING
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Backend Actions:
1. P0 finishes → status:complete written to Redis
2. P0 content saved to D1
3. P1 stream started → chunks to Redis
4. Frontend subscription to /stream/p1 receives chunks
```

### Frame 5→6: All Done → Moderator → Complete

```
┌─────────────────────────────────────────────────────────────────┐
│  ALL PARTICIPANTS DONE → MODERATOR STREAMS → ROUND COMPLETE      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🟢 GPT-5 Nano              Hello                     📋   │  │  DONE
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🔵 DeepSeek V3             Hi                        📋   │  │  DONE
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🌈 Moderator               The council reached       📋🔄│  │  DONE
│  │                             consensus...                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Message DebateKit...                            [SEND]   │  │  RE-ENABLED
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Backend Actions:
1. P1 finishes → all participants complete
2. Phase → MODERATOR
3. Moderator stream started → chunks to Redis
4. Moderator finishes → phase:DONE
5. All content in D1, round state complete
```

---

## Round 2: With Web Search + Changelog

### Frame 7→8: Config Changed → Changelog + PreSearch

```
┌─────────────────────────────────────────────────────────────────┐
│  CONFIG CHANGED: +Gemini, -DeepSeek, +WebSearch                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🕐 Configuration changed                            ▼     │  │  CHANGELOG
│  │     • 1 Added, 1 Modified, 1 Removed                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                       ┌─────────────────────────┐                │
│                       │  what is btc price?     │  USER          │
│                       └─────────────────────────┘                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🌐 Web Research  •         Searching...                   │  │  PRESEARCH
│  │                             ████████░░░░░░  loading...     │  │  STREAMING
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🟢 GPT-5 Nano  •           Searching...                   │  │  BLOCKED
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  💎 Gemini 2.5  •           Thinking...                    │  │  BLOCKED
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🌈 Moderator  •            Observing...                   │  │  BLOCKED
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Backend Phase: PRESEARCH
- PreSearch stream writing to Redis: stream:{tid}:r1:presearch
- All participants BLOCKED until presearch completes
```

### Frame 9→11: PreSearch Done → Participants Stream

```
┌─────────────────────────────────────────────────────────────────┐
│  PRESEARCH COMPLETE → P0 STREAMS (with search context)           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🌐 Web Research            › Searched 3 sources      ✓    │  │  DONE
│  └────────────────────────────────────────────────────────────┘  │
│                         │                                        │
│                         │ SEARCH COMPLETE → UNBLOCK              │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🟢 GPT-5 Nano  •           Based on the search█           │  │  STREAMING
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  💎 Gemini 2.5  •           Thinking...                    │  │  WAITING
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🌈 Moderator  •            Observing...                   │  │  WAITING
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Backend Phase: PARTICIPANTS
- PreSearch content written to D1
- Search results injected into participant prompts
- P0 stream started with search context
```

### Frame 12: Round 2 Complete

```
┌─────────────────────────────────────────────────────────────────┐
│  ROUND 2 COMPLETE                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🌐 Web Research            › Searched 3 sources           │  │  ✓
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🟢 GPT-5 Nano              BTC is at $97,000...      📋   │  │  ✓
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  💎 Gemini 2.5              Current price is...       📋   │  │  ✓
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🌈 Moderator               Both agree BTC is...     📋🔄 │  │  ✓
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Message DebateKit...                            [SEND]   │  │  RE-ENABLED
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Round 3: No Changelog, With Web Search

### Timeline (No Config Changes)

```
┌─────────────────────────────────────────────────────────────────┐
│  ROUND 3: Same participants, web search still ON                 │
│  NO CHANGELOG (nothing changed)                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                       ┌─────────────────────────┐                │
│                       │  compare eth to btc     │  USER          │
│                       └─────────────────────────┘                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🌐 Web Research  •         Searching...                   │  │  PRESEARCH
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🟢 GPT-5 Nano  •           Searching...                   │  │  BLOCKED
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  💎 Gemini 2.5  •           Thinking...                    │  │  BLOCKED
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🌈 Moderator  •            Observing...                   │  │  BLOCKED
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Note: No changelog banner appears because configuration unchanged.
      Flow is: User → PreSearch → P0 → P1 → Moderator
```

---

## Complete Timeline: 3 Rounds

```
TIME ────────────────────────────────────────────────────────────────────────►

ROUND 1 (No Web Search)
│
│  User sends "say hi"
│  │
│  ▼
│  ┌───────┬───────┬───────┐
│  │  P0   │  P1   │  MOD  │   All placeholders appear
│  │ Think │ Think │ Obs   │
│  └───┬───┴───────┴───────┘
│      │
│      ▼  P0 streaming
│  ┌───────┬───────┬───────┐
│  │ "Hi█" │ Think │ Obs   │
│  └───┬───┴───────┴───────┘
│      │
│      ▼  P0 done → P1 starts
│  ┌───────┬───────┬───────┐
│  │ DONE  │"Hey█" │ Obs   │
│  └───────┴───┬───┴───────┘
│              │
│              ▼  P1 done → MOD starts
│  ┌───────┬───────┬───────┐
│  │ DONE  │ DONE  │"The█" │
│  └───────┴───────┴───┬───┘
│                      │
│                      ▼  MOD done → Round complete
│  ┌───────┬───────┬───────┐
│  │ DONE  │ DONE  │ DONE  │   Input re-enabled
│  └───────┴───────┴───────┘
│
├──────────────────────────── Config change: +Gemini, +WebSearch ─────────────
│
ROUND 2 (With Web Search + Changelog)
│
│  User sends "btc price?"
│  │
│  ▼
│  ┌────────┐
│  │CHNGLG  │  Changelog banner (config changed)
│  └────────┘
│  │
│  ▼
│  ┌───────┬───────┬───────┬───────┐
│  │PreSrch│  P0   │  P1   │  MOD  │   All placeholders
│  │Search │Search │ Think │ Obs   │
│  └───┬───┴───────┴───────┴───────┘
│      │
│      ▼  PreSearch streaming (BLOCKS all)
│  ┌───────┬───────┬───────┬───────┐
│  │ "██"  │BLOCKED│BLOCKED│BLOCKED│
│  └───┬───┴───────┴───────┴───────┘
│      │
│      ▼  PreSearch done → P0 starts
│  ┌───────┬───────┬───────┬───────┐
│  │ DONE  │"BTC█" │ Think │ Obs   │
│  └───────┴───┬───┴───────┴───────┘
│              │
│              ▼  P0 done → P1 starts → P1 done → MOD → DONE
│  ┌───────┬───────┬───────┬───────┐
│  │ DONE  │ DONE  │ DONE  │ DONE  │   Input re-enabled
│  └───────┴───────┴───────┴───────┘
│
├──────────────────────────── No config change ───────────────────────────────
│
ROUND 3 (Web Search, No Changelog)
│
│  User sends "compare eth"
│  │
│  ▼  (No changelog - config unchanged)
│  ┌───────┬───────┬───────┬───────┐
│  │PreSrch│  P0   │  P1   │  MOD  │   All placeholders
│  │Search │Search │ Think │ Obs   │
│  └───┬───┴───────┴───────┴───────┘
│      │
│      ▼  Same flow as Round 2
│  ┌───────┬───────┬───────┬───────┐
│  │ DONE  │ DONE  │ DONE  │ DONE  │   Input re-enabled
│  └───────┴───────┴───────┴───────┘
```

---

## Subscription Pattern by Entity

> **UPDATE (2026-01-31):** The multi-endpoint subscription pattern below has been replaced by the **Unified Stream Architecture**. The migration is complete -- all streaming now goes through the unified SSE endpoint.

### Current Implementation: Unified Stream

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ENTITY         │  HOOK / SERVICE                │  REDIS KEY              │
├─────────────────┼────────────────────────────────┼─────────────────────────┤
│  All Phases     │  useDebateKitChat()       │  unified:{tid}:r{N}     │
└─────────────────────────────────────────────────────────────────────────────┘

Single SSE connection handles:
- Pre-search phase (if enabled)
- All participants (sequential)
- Moderator (if 2+ participants)

Phase markers in stream identify current entity:
- event: phase-start (presearch | participant:0 | participant:1 | moderator)
- event: text-delta (content with phase context)
- event: phase-complete
- event: round-complete
```

### Legacy Implementation (Removed)

The following hooks have been removed:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ENTITY         │  HOOK / SERVICE (REMOVED)      │  ACTIVE KEY (D1/Redis)  │
├─────────────────┼────────────────────────────────┼─────────────────────────┤
│  Round Manager  │  useRoundSubscription()        │  (orchestrates below)   │
│  Entity Base    │  useEntitySubscription()       │  (shared subscription)  │
│  Web Research   │  subscribeToPreSearchStream()  │  stream:active:*:ps     │
│  Participant N  │  subscribeToParticipantStream()│  stream:active:*:pN     │
│  Moderator      │  subscribeToModeratorStream()  │  stream:active:*:mod    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Resumption Scenarios

```
SCENARIO 1: User refreshes mid-P1
┌────────────────────────────────────────────────────────────────┐
│  P0: Complete (from D1)                                        │
│  P1: Backend replays ALL P1 SSE data from Redis                │
│      AI SDK dedupes via message-ID replaceMessage (rebuilds)   │
│  P2: Not started (will trigger when P1 completes)              │
│  MOD: Not started                                              │
└────────────────────────────────────────────────────────────────┘

SCENARIO 2: User returns after round complete
┌────────────────────────────────────────────────────────────────┐
│  All: Load from D1 (final messages)                            │
│  Redis streams expired or marked complete                      │
│  Backend returns 204 (no active stream)                        │
│  No active subscriptions needed                                │
└────────────────────────────────────────────────────────────────┘

SCENARIO 3: User returns mid-moderator
┌────────────────────────────────────────────────────────────────┐
│  P0-PN: Complete (from D1)                                     │
│  MOD: Backend replays ALL moderator SSE data from Redis        │
│       AI SDK dedupes via message-ID replaceMessage             │
│  Subscribe to GET /stream (unified endpoint)                   │
└────────────────────────────────────────────────────────────────┘
```

---

## Backend Phase State Machine

**ACTUAL IMPLEMENTATION: 3-Phase + Pre-Search Status**

Pre-search is tracked as a separate status field, not a phase. This allows:
- Cleaner conditional logic for optional web search
- Simpler phase transitions
- Better separation of concerns

```
                     ACTUAL ROUND EXECUTION FLOW

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. ROUND CREATED (status: "pending")                          │
│     └── Initialize round state in Redis                         │
│                                                                 │
│  2. PRE-SEARCH CHECK (preSearchStatus field)                   │
│     ┌──────────────────────────────────────────────┐            │
│     │  Web Search enabled?                         │            │
│     │    YES → preSearchStatus: "running"          │            │
│     │          Stream search results               │            │
│     │          Wait for completion                 │            │
│     │          preSearchStatus: "completed"        │            │
│     │    NO  → preSearchStatus: null (skip)        │            │
│     └──────────────────────────────────────────────┘            │
│                         │                                       │
│                         ▼                                       │
│  3. PHASE: PARTICIPANTS                                         │
│     ┌──────────────────────────────────────────────┐            │
│     │  Sequential execution enforced:              │            │
│     │                                              │            │
│     │  P0 starts (participantStatuses["0"]: "active")          │
│     │      ↓ P0 completes                          │            │
│     │  P1 starts (only after P0 "completed"|"failed")          │
│     │      ↓ P1 completes                          │            │
│     │  P2 starts (only after P1 "completed"|"failed")          │
│     │      ↓ ...                                   │            │
│     │  All participants complete                   │            │
│     └──────────────────────────────────────────────┘            │
│                         │                                       │
│                         ▼                                       │
│  4. PHASE: MODERATOR                                            │
│     ┌──────────────────────────────────────────────┐            │
│     │  moderatorStatus: "active"                   │            │
│     │  Stream moderator response                   │            │
│     │  moderatorStatus: "completed"                │            │
│     └──────────────────────────────────────────────┘            │
│                         │                                       │
│                         ▼                                       │
│  5. PHASE: COMPLETE                                             │
│     └── status: "completed", phase: "complete"                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

PHASE ENUM VALUES (RoundExecutionPhases):
  - "participants" → P0...PN executing sequentially
  - "moderator"    → Moderator streaming
  - "complete"     → Round finished

STATUS ENUM VALUES (RoundExecutionStatuses):
  - "pending"   → Round created, not started
  - "running"   → Active execution
  - "completed" → Successfully finished
  - "failed"    → Error occurred

PRE-SEARCH STATUS VALUES (separate from phase):
  - null        → Web search disabled for this round
  - "pending"   → Queued but not started
  - "running"   → Currently searching
  - "completed" → Search done, results available
  - "failed"    → Search error (participants proceed anyway)
```

---

## Frontend Phase Machine (Zustand Store)

The frontend uses a 5-phase state machine in the Zustand store (`stores/chat/store.ts`),
distinct from the backend's 3-phase model. Pre-search is a full phase on the frontend
to drive UI state (loading indicators, card expansion/collapse).

```
ChatPhaseValues = ['idle', 'presearch', 'participants', 'moderator', 'complete']

Phase Flow:
  idle → presearch → participants → moderator → complete → idle
         (optional)                 (if 2+ participants)

Transitions:
  startRound()              → PRESEARCH (if web search enabled) or PARTICIPANTS
  transitionToParticipants()→ PARTICIPANTS (from PRESEARCH, after 1.5s view delay)
  onParticipantComplete()   → MODERATOR (when all participants complete, if 2+ participants)
                            → COMPLETE (when all complete, if single participant)
  completeStreaming()       → COMPLETE (from any streaming phase)
  prepareForNewMessage()    → IDLE (from COMPLETE)

Pre-Search to Participants Delay:
  When pre-search completes, a 1.5s delay (PRESEARCH_VIEW_DELAY_MS) allows
  users to see search results before participants begin streaming.
  During this delay, phase remains PRESEARCH.

Participant Completion Tracking:
  completedParticipantCount increments via incrementCompletedParticipants().
  onParticipantComplete() checks if all done (completedParticipantCount >= activeRoundParticipantCount).
  If all done and participantCount >= 2: transitions to MODERATOR.
  If all done and participantCount < 2: skips to COMPLETE.

Moderator Phase Guard:
  setPhaseToModerator() only transitions from PARTICIPANTS phase.
  Resume from server directly sets phase via resumeIntoStreaming().
```

---

## Race Condition Handling

> **NOTE (2026-02):** Many of these guards were designed for the legacy per-entity streaming
> architecture. The current unified stream uses sequential `await` ordering in
> `executeUnifiedRoundStream()`, which eliminates participant ordering races.
> Chunk initialization and stale stream detection are handled by the `resumable-stream` package.

The implementation includes several guards against race conditions inherent in
distributed Redis/D1-based coordination.

### 1. DB-Redis Sync Validation

**Problem:** Redis status might show "completed" before D1 write finishes.

**Solution:** `getDbValidatedNextParticipant()` cross-validates:
```typescript
// Never go backwards from current streaming index
// If P1 is streaming, don't return P0 (race condition)
if (currentStreamingIndex !== undefined && i < currentStreamingIndex) {
  continue; // Skip - message will appear in D1 soon
}
```

### 2. Chunk Initialization Race (FIX #6 - Enhanced)

**Problem:** Chunks may arrive before metadata initializes in Redis.

**Solution:** Three-phase approach in `appendParticipantStreamChunk()`:

```typescript
// Phase 1: Exponential backoff retry (total ~3.5s)
const MAX_RETRIES = 8;
const BASE_DELAY_MS = 50;
const MAX_DELAY_MS = 1000;
// Delays: 50ms, 100ms, 200ms, 400ms, 800ms, 1000ms, 1000ms

// Phase 2: Pending queue fallback
// If metadata still missing after retries, store chunk in pending queue
await storePendingChunk(streamId, data, env, logger);

// Phase 3: Process pending when metadata available
// When metadata appears, flush pending queue in order
await processPendingChunks(streamId, metadata, env, logger);
```

**Trade-off:** Longer timeout (~3.5s vs 150ms) in exchange for zero chunk loss.
This is intentional - chunk data loss is worse than brief latency.

### 3. Stale Stream Detection

**Problem:** Stream may hang without activity.

**Solution:** Timeout detection marks stream as FAILED:
```typescript
const streamIsOldWithNoChunks = hasNoChunks
  && streamCreatedTime > 0
  && Date.now() - streamCreatedTime > STALE_CHUNK_TIMEOUT_MS; // 30s
```

### 4. Sequential Ordering Enforcement

**Problem:** P1+ could start before P0 completes.

**Solution:** `createWaitingParticipantStream()` enforces ordering:
```typescript
if (participantIndex > 0) {
  const allPreviousComplete = prevStatuses.every(status =>
    status === 'completed' || status === 'failed'
  );
  if (!allPreviousComplete) {
    continue; // Keep waiting
  }
}
```

### 5. Pre-Search Gate

**Problem:** Participants could start before pre-search completes.

**Solution:** Pre-search completion check before participant triggers:
- Queue orchestration delays participant messages until `preSearchStatus === 'completed'`
- Frontend triple-redundancy: SSE event, callback, effect backup

---

## Error Handling Patterns

### Stream Timeout Error Events

When a stream times out without completing, the backend sends explicit error
events before the synthetic finish:

```typescript
// SSE error event format
event: error
data: {"type":"error","error":"STREAM_TIMEOUT","message":"Stream timed out after 300s (5min) absolute timeout"}

event: finish
data: {"type":"finish","finishReason":"error","error":"STREAM_TIMEOUT"}
```

### Response Status Codes

| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| 200 + SSE | Active stream | Subscribe and display |
| 200 + JSON | Completed or cursor beyond chunks | Load from response |
| 204 | No active stream (resumption endpoint) | Skip subscription |

### Frontend Error Recovery

```typescript
// Triple-redundancy for presearch completion detection
1. SSE 'done' event → handleEntityComplete()
2. Status change callback → enables P0
3. Effect-based backup → catches React batching edge cases
```

---

## Summary: Key Architecture Principles

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  1. BACKEND ORCHESTRATES                                       │
│     - Decides what runs next                                   │
│     - Manages turn order (P0 → P1 → ... → Moderator)           │
│     - Writes chunks to Redis as they arrive                       │
│     - Saves final content to D1                                │
│                                                                │
│  2. FRONTEND SUBSCRIBES                                        │
│     - Never decides what happens next                          │
│     - Subscribes to SSE streams                                │
│     - Displays chunks as they arrive                           │
│     - AI SDK deduplicates replayed content (replaceMessage)    │
│                                                                │
│  3. UPSTASH REDIS FOR REAL-TIME                                │
│     - SSE buffer: raw SSE strings via RPUSH (O(1) append)      │
│     - Unified buffer: typed chunks via RPUSH + LRANGE           │
│     - Strongly consistent (no eventual consistency delay)       │
│     - TTL for automatic cleanup (1 hour)                       │
│                                                                │
│  4. D1 FOR DURABILITY                                          │
│     - Final messages persisted                                 │
│     - Source of truth for completed content                    │
│     - Used for resumption of completed entities                │
│                                                                │
│  5. UNIFIED STREAM RESUMABLE                                   │
│     - Active stream tracked in D1 (active_stream table)        │
│     - SSE buffer in Redis: sse:{streamId}:data                 │
│     - Resume via GET: backend replays ALL SSE; client dedupes  │
│     - Completeness managed internally by `resumable-stream` pkg│
│                                                                │
│  6. 3-PHASE STATE MACHINE                                      │
│     - Phases: participants → moderator → complete              │
│     - Pre-search tracked as STATUS FIELD (not phase)           │
│     - Simpler conditional logic for optional features          │
│                                                                │
│  7. RACE CONDITION GUARDS                                      │
│     - DB-Redis sync validation                                 │
│     - Chunk initialization retries                             │
│     - Absolute stream timeout (300s via AbortSignal.timeout)   │
│     - Sequential ordering enforcement                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## AI SDK Resumable Streams Pattern Comparison

This implementation follows the AI SDK resumable streams pattern, using
Upstash Redis for stream buffering and D1 for active stream tracking.

### Pattern Mapping

| AI SDK Pattern | DebateKit Implementation |
|----------------|---------------------------|
| `resumable-stream` package | `unified-redis-stream-buffer.service.ts` (round state + SSE replay via `resumable-stream` npm package) |
| Redis pub/sub | Upstash Redis (strongly consistent RPUSH/LRANGE) |
| `activeStreamId` in DB | `active_stream` table in D1 (via `active-stream-db.service.ts`) |
| `consumeSseStream` callback | Managed internally by `resumable-stream` package via `waitUntil` |
| GET `/stream` endpoint | `resumeUnifiedRoundStreamHandler` in `unified-round-stream.handler.ts` |
| POST creates stream | `createUIMessageStreamResponse()` + Redis init |
| `onFinish` clears activeStreamId | Managed by `resumable-stream` package; D1 cleared by resume handler after serving |
| 204 No Content | Returned when no active stream or buffer incomplete |

### Key Differences from AI SDK Pattern

1. **Multi-Entity Coordination**: AI SDK pattern assumes single stream per chat.
   We track multiple concurrent entities (presearch, P0-PN, moderator) with
   sequential ordering enforcement.

2. **Server-Side Waiting Streams**: Instead of client polling with 204 + retry,
   we use `createWaitingParticipantStream()` that holds the connection until
   the previous participant completes.

3. **Queue-Based Orchestration**: Backend queue triggers next participant
   automatically without frontend POST requests.

4. **Chunk Storage**: Redis RPUSH lists for both SSE buffer and unified round state.
   Pre-search uses separate KV keys per chunk. Redis provides O(1) append and
   strongly consistent reads (no eventual consistency delay).

### Frontend Resume Integration

```typescript
// AI SDK pattern (simplified)
const { messages } = useChat({
  resume: resumeEnabled,  // Controlled by provider latch — NOT hardcoded true
  transport: new DefaultChatTransport({
    prepareReconnectToStreamRequest: ({ id }) => ({
      api: `/api/chat/${id}/stream`,
      // NOTE: No lastSeq parameter sent to backend
      // Backend replays all data; AI SDK deduplicates via replaceMessage-by-ID
    }),
  }),
});

// DebateKit implementation — 3-guard resume latch in ChatStoreProvider
// resume fires ONLY when ALL three guards pass:
//   1. Store indicates active streaming (hydrated from Redis/SSR streamingState)
//   2. AI SDK's POST SSE is not already active (prevents GET/POST race)
//   3. No pending POST was just fired (hadPendingMessageRef)
//
// Completed threads: isStreaming=false → latch never fires → zero 204 GETs
// Active threads: isStreaming=true + AI SDK idle → latch fires → GET reconnects
```

### Resumption Endpoint Signatures

```typescript
// Resume stream (SSE response) - AI SDK v6 native pattern
// NOTE: No lastSeq parameter -- backend replays all, client deduplicates
GET /api/threads/{threadId}/stream
→ 204 No Content (no active stream)
→ 200 + SSE (active stream, replays ALL chunks from beginning)

// Client-side dedup: AI SDK v6 AbstractChat.makeRequest uses the existing
// assistant message ID; replayed stream rebuilds message via replaceMessage()
// (not pushMessage), so no duplicate content accumulates.

// NOTE: stream-status endpoint removed - AI SDK resume: true handles resumption natively
// useChat with resume: true calls GET /stream on mount, no separate metadata endpoint needed
```

---

## Client-Side Stream Resumption

The frontend handles three distinct resumption scenarios: full page refresh (SSR hydration), client-side SPA navigation, and tab visibility changes. Each uses different mechanisms, and confusing them is the primary source of resumption bugs.

### CRITICAL DISTINCTION: Full Refresh vs Client-Side Navigation

```
FULL PAGE REFRESH (F5 / direct URL / new tab):
  Server renders HTML → route loader runs server-side →
  streamingState from Redis included in SSR payload →
  useSyncHydrateStore hydrates from SSR data →
  AI SDK resume GET reconnects to live stream

CLIENT-SIDE NAVIGATION (SPA link click):
  No server rendering → route loader runs client-side →
  ensureQueryData fetches thread JSON →
  useSyncHydrateStore hydrates from fetched data →
  Provider resume latch evaluates 3 guards →
  If POST SSE alive: no resume GET (data flows naturally)
  If POST SSE dead: resume GET reconnects
```

### 1. SSR Hydration Resume Flow (Full Page Refresh Only)

When a user loads or refreshes a page with an active server-side stream:

1. **Route loader fetches fresh data** (including `streamingState` from Redis). Thread query has 5min staleTime, so `invalidateThreadCache` is called on navigate-away to ensure the loader fetches fresh data (not stale cache) on navigate-back.
   - File: `apps/web/src/components/providers/chat-store-provider/hooks/use-navigation-cleanup.ts:48-56`
2. `ChatThreadScreen` renders. `useSyncHydrateStore` runs in `useLayoutEffect` (child component).
   - File: `apps/web/src/stores/chat/index.ts`
3. Hydration order (via `useSyncHydrateStore`):
   a. `initializeThread()` -- populates thread, participants, and merged messages in store
   b. `setSelectedParticipants()` -- syncs form state with correct models
   c. Phase and streaming state are derived from the store's phase machine
4. Provider's resume guard: `resume = effectiveThreadId !== createdThreadId`. When mounting on a thread that wasn't just created, AI SDK's `useChat({ resume: true })` fires a GET to check for active streams.
   - File: `apps/web/src/components/providers/chat-store-provider/provider.tsx`
5. Hook's thread change detection (runs in `useEffect`) detects thread via `prevThreadIdRef`. On first mount, it syncs refs with existing streaming messages but does NOT reset the store.
   - File: `apps/web/src/hooks/streaming/use-debatekit-chat.ts`
6. AI SDK `resume: true` fires a GET to the backend stream endpoint. **Backend replays ALL SSE from Redis buffer** (no `lastSeq` parameter sent). AI SDK deduplicates natively: `AbstractChat.makeRequest` reuses the existing assistant message by ID and calls `replaceMessage()` (not `pushMessage()`), rebuilding the message from scratch. Hook callbacks route incoming data parts to the store for phase tracking.

### 2. Client-Side Navigation Resume Flow

Client-side navigation uses cache invalidation + re-fetch + resume latch. **No `chatStop()` or abort on navigation** -- AI SDK v6 resume contract forbids aborting resumable streams. The POST SSE connection may survive navigation (provider stays mounted at `_protected` layout level).

1. **On navigate away**: `useNavigationCleanup` (runs in `useLayoutEffect`) calls:
   - **`invalidateThreadCache(prevPath)`** to invalidate the thread query cache (5min staleTime)
   - `resetForThreadNavigation()` or `resetToOverview()` to clear store state
   - **Does NOT call `chatStop()` or abort** -- POST SSE continues via `waitUntil`
   - File: `apps/web/src/components/providers/chat-store-provider/hooks/use-navigation-cleanup.ts`

2. **On navigate back**: Route loader's `ensureQueryData` fetches **fresh thread data** (not stale cache) because the cache was invalidated. `useSyncHydrateStore` hydrates the store with the fetched data.

3. **Thread change detection evaluates**: The hook detects the thread change via `prevThreadIdRef`. Thread change resets hook refs (clears `dispatchedCompletionsRef`, `roundCompleteDispatchedRef`, and other tracking refs) so incoming resume data is processed correctly.
   - File: `apps/web/src/hooks/streaming/use-debatekit-chat.ts`

4. **Resume latch evaluates**: The provider passes `resume: effectiveThreadId !== createdThreadId && !postInFlightRef.current` to `useDebateKitChat`, which forwards it to `useChat`. Two guards:
   - `effectiveThreadId !== createdThreadId` -- prevents resume GETs for brand-new threads (no active stream to resume)
   - `!postInFlightRef.current` -- prevents resume GET when a POST is currently in-flight (prevents GET/POST race)
   - For existing threads, AI SDK's built-in resume handles reconnection automatically.
   - File: `apps/web/src/components/providers/chat-store-provider/provider.tsx`

5. **204 detection via chatStatus effect**: If the resume GET returns 204 (no active stream), `onFinish` does NOT fire. Instead, the `chatStatus` effect in `useDebateKitChat` detects the SUBMITTED→READY transition without any data parts received (`dataPartsReceivedRef.current === false`) and calls `handleNoActiveStream()` to complete the streaming phase in the store.
   - File: `apps/web/src/hooks/streaming/use-debatekit-chat.ts`

### 3. Why Client-Side Navigation Resumption Can Fail

The primary failure mode occurs when `useSyncHydrateStore` hydrates with stale server data while a POST SSE is still actively delivering chunks:

```
FAILURE SCENARIO:
  1. User starts round on overview -> navigates to thread-by-slug
  2. Provider stays mounted, POST SSE is alive and delivering chunks
  3. Thread-by-slug route loader fetches thread data from API
  4. useSyncHydrateStore hydrates store with server data
     (which may be STALE -- D1 writes lag behind Redis chunks)
  5. This OVERWRITES the live streaming state from the POST SSE
  6. Result: chunks arrive but store has been reset, causing misalignment
     (wrong roundNumber, missing placeholders, lost phase state)

MITIGATION:
  - useSyncHydrateStore checks deriveIsStreaming(currentState.phase)
    before overwriting streaming-related state
  - postInFlightRef blocks resume GET when POST SSE is alive
  - Thread query cache invalidation ensures fresh data on next fetch
  - useThreadReset Branch 1 (first mount) syncs with existing messages
    rather than blindly resetting
```

### 4. Tab Visibility Reconnect

> **NOTE (2026-02):** `use-visibility-reconnect.ts` has been deleted. Tab reconnection is now handled by the AI SDK's built-in resume mechanism via `handleNoActiveStream()` callback in `use-round-lifecycle.ts`. When the SSE connection drops (tab hidden, network loss), the AI SDK detects it on next mount and the `handleNoActiveStream` callback transitions the store to idle if no active stream exists.

### 5. Key Refs and Guards

| Ref | Location | Purpose |
|-----|----------|---------|
| `roundCompleteDispatchedRef` | Hook (`use-debatekit-chat.ts`) | Prevents double `onRoundComplete` when both `handleDataPart` round-complete event and `onFinish` force-complete fire |
| `dispatchedCompletionsRef` | Hook (`use-debatekit-chat.ts`) | Set of dedup keys (`r{N}:p{i}`, `moderator`) to prevent duplicate participant/moderator completion dispatches |
| `dataPartsReceivedRef` | Hook (`use-debatekit-chat.ts`) | Set to true when first streaming data arrives; used for 204 detection (SUBMITTED→READY without data = no active stream) |
| `prevThreadIdRef` | Hook (`use-debatekit-chat.ts`) | Tracks previous thread ID for thread change detection + ref reset |
| `sendMessageLockRef` | Hook (`use-debatekit-chat.ts`) | Prevents re-entrant startRound calls |
| `currentParticipantRef` | Hook (`use-debatekit-chat.ts`) | Tracks active participant for force-complete on stream close |
| `startedRoundRef` | Hook (`use-debatekit-chat.ts`) | Tracks started round number for dedup key generation |
| `noActiveStreamTimeoutRef` | Hook (`use-debatekit-chat.ts`) | Timeout handle for 204 no-active-stream detection; cleared on thread change and stop() |
| `hasFatalErrorRef` | Hook (`use-debatekit-chat.ts`) | Guards against processing stream events after a fatal error |

### 6. AI SDK v6 onFinish Discrimination

The hook's `onFinish` callback receives flags for stream end classification:

- `isAbort=true`: User called `stop()` or AbortController triggered (navigation away)
- `isDisconnect=true`: Network error (TypeError with "fetch" or "network")
- `isError=true`: Any error occurred (superset of disconnect). The hook now handles this flag: sets `streamError` state and dispatches `onErrorRef` callback, then still force-completes the round to avoid hanging.
- Resume GET returning 204 (no active stream): `onFinish` MAY fire with empty flags but no data parts. The `dataPartsReceivedRef` guard in `onFinish` early-returns for this case.

The hook uses these flags to decide whether to force-complete the round (`isDisconnect` with incomplete phase) or silently exit (`isAbort` during navigation).

### 7. React Effect Execution Order

Understanding this order is critical for the resume flow:

1. **Children's `useLayoutEffect`** -- `ChatThreadScreen` runs `useSyncHydrateStore`, populating the store with thread data and streaming placeholders.
2. **Parent's `useLayoutEffect`** -- `useNavigationCleanup` runs cleanup for the previous route (cache invalidation, store reset). Provider's latch effect evaluates on the same render cycle.
3. **`useEffect` callbacks** -- Thread change detection in `use-debatekit-chat.ts` resets phase/completion refs. 204 detection via `chatStatus` effect.

This ordering is enforced by React's effect execution model: layout effects run bottom-up (children before parents), regular effects run after all layout effects.

### 8. Resume Architecture (Simplified)

> **NOTE (2026-02):** The complex 3-guard resume latch in provider.tsx has been replaced by a simpler pattern. The provider passes `resume: effectiveThreadId !== createdThreadId && !postInFlightRef.current` to `useDebateKitChat`, which forwards it to `useChat`. The first guard prevents resume GETs for brand-new threads (no active stream to resume). The `postInFlightRef` guard prevents resume GETs while a POST is in flight (race condition where POST response hasn't returned yet). For existing threads, AI SDK's built-in resume handles reconnection automatically.

```
RESUME FLOW:

  NEW THREAD (createdThreadId matches effectiveThreadId):
    resume = false  →  No resume GET fired
    POST creates new stream normally

  EXISTING THREAD (navigating to /chat/:slug):
    resume = true   →  AI SDK fires resume GET on mount
    If 204: handleNoActiveStream() transitions store to idle
    If 200 + SSE: Data flows through onData → handleDataPart → callbacks → store

  PAGE REFRESH (F5 / direct URL):
    Route loader fetches thread + streaming state from Redis
    useSyncHydrateStore hydrates store
    resume = true → AI SDK reconnects to active stream
    Callbacks detect activeRoundNumber === -1 and call resumeIntoStreaming()
```

### 9. Critical Anti-Patterns

**NEVER call `chatStop()` or `stop()` during navigation.** AI SDK v6 docs state: "Stream resumption is not compatible with abort functionality." Calling `chatStop()` sends an AbortSignal that corrupts the Redis resumable stream, making the resume GET fail and causing content to be permanently lost. Backend continues via `waitUntil` regardless of client SSE state.

**NEVER hardcode `resume: true` in the hook without a guard.** The `resume` prop must be gated to prevent resume GETs for brand-new threads. The provider's `effectiveThreadId !== createdThreadId` guard handles this.

---

## Virtual Message Splitting

AI SDK v6 accumulates all participant responses into a single `UIMessage` during unified streaming (one SSE connection carries presearch → participants → moderator). The rendering layer needs per-participant messages.

### How It Works

```
BACKEND sends to single UIMessage:
  [data-phase:participant:0:start] [text: "Hello"] [data-phase:participant:0:complete]
  [data-phase:participant:1:start] [text: "Hi"]    [data-phase:participant:1:complete]
  [data-phase:moderator:start]     [text: "Both..."] [data-phase:moderator:complete]

AI SDK stores as ONE UIMessage with all parts:
  UIMessage { id: "msg_1", parts: [...all 9 parts...] }

splitUnifiedStreamMessages() splits into VIRTUAL UIMessages:
  UIMessage { id: "msg_1_p0",       parts: [p0 text + data-phase] }
  UIMessage { id: "msg_1_p1",       parts: [p1 text + data-phase] }
  UIMessage { id: "msg_1_moderator", parts: [moderator text + data-phase] }
```

**File**: `lib/utils/split-unified-stream-messages.ts`

- Detects `data-phase` start boundaries in the parts array
- Slices parts between boundaries into per-participant segments
- Generates virtual message IDs: `{originalId}_p{index}` or `{originalId}_moderator`
- Enriches virtual metadata with participantId, participantIndex, model
- Caches completed messages via WeakMap (streaming messages excluded, parts-length validated on cache hit to handle resumed messages that grow)
- Runs at view level (`ChatView.tsx useMemo`) to keep AI SDK internal state intact

---

## 204 Detection Pattern

When a resume GET returns 204 (no active stream), `onFinish` does NOT fire. The hook detects this via the `chatStatus` effect:

```
SUBMITTED → READY transition without data = no active stream

1. useChat fires resume GET
2. chatStatus becomes "submitted"
3. Backend returns 204 No Content
4. chatStatus transitions to "ready"
5. Hook checks: dataPartsReceivedRef.current === false?
6. YES → handleNoActiveStream() → store transitions to idle
7. NO  → Normal stream end (data was received)
```

**Key**: `dataPartsReceivedRef.current` is set to `true` BEFORE the `isStreamEnabled` guard in `onData`, so it tracks raw transport data arrival regardless of processing state.

---

## StrictMode Resume Dedup

React StrictMode double-mounts components, which can fire duplicate resume GETs.

```
WITHOUT GUARD:
  Mount #1 → resume: true → GET #1
  StrictMode unmount
  Mount #2 → resume: true → GET #2  (duplicate!)

WITH resumeInitiatedRef GUARD:
  Mount #1 → resume: true → GET #1 → ref set to threadId
  StrictMode unmount
  Mount #2 → resumeInitiatedRef === threadId → resume: false → no GET
```

**File**: `hooks/streaming/use-debatekit-chat.ts`
- `resumeInitiatedRef` tracks the threadId for which resume was already initiated
- Set when `chatStatus === 'submitted'` (resume GET fired)
- Reset to `null` on thread change

---

## AI SDK v6 Schema Integration

### dataPartSchemas

The `useChat` hook receives `dataPartSchemas` for automatic Zod validation of all 6 custom data part types:

```typescript
// packages/shared/src/types/unified-round-stream.ts
export const unifiedDataPartSchemas = {
  'artifact-available-sources': ArtifactAvailableSourcesDataPartSchema,
  'artifact-presearch':         ArtifactPresearchDataPartSchema,
  'error':                      StreamErrorDataSchema,
  'heartbeat':                  HeartbeatDataSchema,
  'phase':                      PhaseMarkerDataSchema,
  'round-complete':             RoundCompleteDataSchema,
} as const;
```

Keys map to wire type suffix after `data-` prefix (e.g., `'phase'` → `data-phase` on wire). Presearch and available-sources use the `artifact-` prefix pattern for AI SDK artifact integration.

### messageMetadataSchema

Runtime validation of streamed metadata via `UnifiedMessageMetadataSchema`:

```typescript
export const UnifiedMessageMetadataSchema = z.object({
  isModerator: z.boolean().optional(),
  isPresearch: z.boolean().optional(),
  model: z.string().optional(),
  participantId: z.string().optional(),
  participantIndex: z.number().int().min(0).optional(),
  role: MessageRoleSchema.optional(),
  roundNumber: z.number().int().min(0).optional(),
});
```

### Transient Phase Markers

Phase markers (`data-phase` parts) use a **split transient strategy**:
- **START markers** (`status: 'start'`): **NOT transient** — persisted in `UIMessage.parts` so `splitUnifiedStreamMessages` can detect participant boundaries in accumulated messages.
- **COMPLETE/ERROR markers** (`status: 'complete'` / `status: 'error'`): **transient: true** — delivered to `onData` for phase callbacks but NOT persisted in parts (event-only, not needed for rendering/splitting).

---

## Implementation Files Reference

### Backend (apps/api/src/)

| File | Purpose |
|------|---------|
| `services/streaming/unified-redis-stream-buffer.service.ts` | Redis: typed round state chunks + metadata (RPUSH/HSET) |
| `services/streaming/unified-stream-buffer.service.ts` | KV: pre-search stream chunks (individual keys) |
| `services/streaming/active-stream-db.service.ts` | D1: active stream record CRUD (streamId lookup for resume) |
| `services/streaming/unified-stream-orchestration.service.ts` | Orchestrates presearch, participants, moderator via `createUIMessageStream` |
| `services/streaming/stream-utils.ts` | Shared helpers: StreamKeyBuilder, parseChunkArray, getErrorMessage |
| ~~`services/streaming/redis-round-state.service.ts`~~ | Removed: was dead code (getter with no setter) |
| `services/round-orchestration/round-orchestration.service.ts` | Phase state machine, status updates |
| `services/orchestration/streaming-orchestration.service.ts` | Legacy: AI SDK streamText integration, message building |
| `routes/chat/handlers/unified-round-stream.handler.ts` | POST (start) + GET (resume) unified stream endpoints |

### Frontend (apps/web/src/)

| File | Purpose |
|------|---------|
| `hooks/streaming/use-debatekit-chat.ts` | Thin wrapper over @ai-sdk-tools/store useChat with DebateKit phase tracking |
| `hooks/streaming/handlers/handle-data-part.ts` | Factory routing custom SSE data parts to phase-specific callbacks |
| `hooks/streaming/config/stream-transport.ts` | DefaultChatTransport config with dynamic round-specific endpoints |
| `lib/utils/split-unified-stream-messages.ts` | Splits AI SDK accumulated messages into per-participant UIMessages |
| `lib/utils/streaming-helpers.ts` | Streaming ID generators, status checks, participant counting |
| `components/providers/chat-store-provider/provider.tsx` | Store factory, stream hook orchestration, round triggering |
| `components/providers/chat-store-provider/hooks/use-navigation-cleanup.ts` | Cache invalidation + store reset on route change (no abort) |
| `components/providers/chat-store-provider/hooks/use-round-trigger.ts` | Guards and triggers for starting new streaming rounds |
| ~~`components/providers/chat-store-provider/hooks/use-stream-callbacks/`~~ | Removed — callbacks inlined into handle-data-part.ts and provider.tsx |
| `components/providers/chat-layout-providers.tsx` | 3-layer provider stack: AiSdkStoreProvider → ChatStoreProvider → AIDevtoolsProvider |
| `stores/chat/store.ts` | Zustand store: phase machine, participant tracking, snapshots (all actions inline) |
| `stores/chat/selectors.ts` | Derived state: `deriveIsStreaming(phase)` (PRESEARCH/PARTICIPANTS/MODERATOR), `deriveWaitingToStartStreaming(phase, pendingMessage)` (IDLE or COMPLETE + pendingMessage), pre-search selectors |
| `stores/chat/actions/form-actions.ts` | Thread creation, message submission, participant management |
