/**
 * Thread Creation Service
 *
 * Drizzle ORM replacement for raw D1 SQL in apps/mcp/src/engine/thread-creator.ts.
 * Atomic thread creation from completed MCP debates using db.batch().
 */

import { ChatModeSchema, DEFAULT_CHAT_MODE, MCPToolMethodSchema, MODERATOR_PARTICIPANT_INDEX } from '@debatekit/shared/enums';
import { eq } from 'drizzle-orm';
import * as z from 'zod';

import type { DbInstance } from '../factory';
import type { DbAssistantMessageMetadata, DbMessageParts, DbModeratorMessageMetadata, DbThreadMetadata, DbUserMessageMetadata } from '../schemas/chat-metadata';
import { chatMessage, chatParticipant, chatThread, roundExecution } from '../tables/chat';

// ============================================================================
// Schemas & Types
// ============================================================================

const ParticipantInputSchema = z.object({
  modelId: z.string(),
  modelName: z.string(),
  response: z.string(),
  role: z.string().optional(),
});

const _CreateThreadFromDebateParamsSchema = z.object({
  context: z.string().optional(),
  mode: z.string(),
  moderatorModelId: z.string(),
  moderatorSummary: z.string(),
  participants: z.array(ParticipantInputSchema),
  prompt: z.string(),
  sessionId: z.string(),
  /** Optional AI-generated title; falls back to truncated prompt */
  title: z.string().optional(),
  toolName: z.string(),
  userId: z.string(),
});

type CreateThreadFromDebateParams = z.infer<typeof _CreateThreadFromDebateParamsSchema>;

type CreateThreadFromDebateResult = {
  threadId: string;
  threadSlug: string;
};

// ============================================================================
// Helpers (not exported)
// ============================================================================

function toKebabCase(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
    .replace(/^-|-$/g, '');
}

const MAX_SLUG_ATTEMPTS = 3;

async function generateUniqueSlug(db: DbInstance, prompt: string) {
  const base = toKebabCase(prompt) || 'mcp-session';

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const randomId = crypto.randomUUID().slice(0, 8);
    const slug = `${base}-${randomId}`;

    const existing = await db.query.chatThread.findFirst({
      columns: { id: true },
      where: eq(chatThread.slug, slug),
    });

    if (!existing) {
      return slug;
    }
  }

  // Final fallback: use full UUID for guaranteed uniqueness
  return `${base}-${crypto.randomUUID()}`;
}

function mapToChatMode(mode: string) {
  const result = ChatModeSchema.safeParse(mode);
  return result.success ? result.data : DEFAULT_CHAT_MODE;
}

// ============================================================================
// Thread Creation
// ============================================================================

/**
 * Create a full chat thread from a completed MCP debate.
 *
 * Inserts thread, participants, user message, participant responses,
 * moderator summary, and round execution in a single atomic db.batch().
 */
export async function createThreadFromDebate(
  db: DbInstance,
  params: CreateThreadFromDebateParams,
): Promise<CreateThreadFromDebateResult> {
  const {
    context,
    mode,
    moderatorModelId,
    moderatorSummary,
    participants,
    prompt,
    sessionId,
    title: titleOverride,
    toolName,
    userId,
  } = params;

  const threadId = crypto.randomUUID();
  const threadSlug = await generateUniqueSlug(db, prompt);
  const now = new Date();

  // Title: prefer AI-generated override, fall back to truncated prompt
  const title = titleOverride ?? (prompt.length > 100 ? `${prompt.slice(0, 97)}...` : prompt);

  // Map debate mode to valid chat mode
  const chatMode = mapToChatMode(mode);

  // Thread metadata (typed via DbThreadMetadata)
  const toolParsed = MCPToolMethodSchema.safeParse(toolName);
  const metadata: DbThreadMetadata = {
    mcpSessionId: sessionId,
    mcpToolName: toolParsed.success ? toolParsed.data : undefined,
    source: 'mcp',
  };

  // Pre-generate participant IDs for FK references in messages
  const participantRecords = participants.map((p, i) => ({
    id: crypto.randomUUID(),
    modelId: p.modelId,
    priority: i,
    role: p.role ?? null,
  }));

  // Build all Drizzle insert operations
  const insertThread = db.insert(chatThread).values({
    createdAt: now,
    id: threadId,
    isAiGeneratedTitle: true,
    isPublic: false,
    lastMessageAt: now,
    metadata,
    mode: chatMode,
    slug: threadSlug,
    status: 'active',
    title,
    updatedAt: now,
    userId,
    version: 1,
  });

  const insertParticipants = participantRecords.map(rec =>
    db.insert(chatParticipant).values({
      createdAt: now,
      id: rec.id,
      isEnabled: true,
      modelId: rec.modelId,
      priority: rec.priority,
      role: rec.role,
      threadId,
      updatedAt: now,
    }),
  );

  // User message (round 0) -- include context so the thread shows full picture
  const fullUserMessage = context
    ? `${prompt}\n\n## Context\n${context}`
    : prompt;
  const userParts: DbMessageParts = [{ text: fullUserMessage, type: 'text' }];
  const userMetadata: DbUserMessageMetadata = { role: 'user', roundNumber: 0 };

  const insertUserMessage = db.insert(chatMessage).values({
    createdAt: now,
    id: crypto.randomUUID(),
    metadata: userMetadata,
    participantId: null,
    parts: userParts,
    role: 'user',
    roundNumber: 0,
    threadId,
  });

  // Participant response messages (round 0)
  // Metadata mirrors DbAssistantMessageMetadataSchema required fields
  // so frontend type guards (isAssistantMessageMetadata) work correctly.
  const insertParticipantMessages = participants.map((p, i) => {
    const parts: DbMessageParts = [{ text: p.response, type: 'text' }];
    const record = participantRecords[i];
    if (!record) {
      throw new Error(`Missing participant record at index ${i}`);
    }

    const msgMetadata: DbAssistantMessageMetadata = {
      finishReason: 'stop',
      hasError: false,
      isPartialResponse: false,
      isTransient: false,
      model: p.modelId,
      participantId: record.id,
      participantIndex: i,
      participantRole: p.role ?? null,
      role: 'assistant',
      roundNumber: 0,
      usage: { completionTokens: 0, promptTokens: 0, totalTokens: 0 },
    };

    return db.insert(chatMessage).values({
      createdAt: new Date(now.getTime() + i + 1),
      id: crypto.randomUUID(),
      metadata: msgMetadata,
      participantId: record.id,
      parts,
      role: 'assistant',
      roundNumber: 0,
      threadId,
    });
  });

  // Moderator summary message (round 0)
  const modParts: DbMessageParts = [{ text: moderatorSummary, type: 'text' }];
  const modMetadata: DbModeratorMessageMetadata = {
    finishReason: 'stop',
    hasError: false,
    isModerator: true,
    model: moderatorModelId,
    participantIndex: MODERATOR_PARTICIPANT_INDEX,
    role: 'assistant',
    roundNumber: 0,
  };

  const insertModeratorMessage = db.insert(chatMessage).values({
    createdAt: new Date(now.getTime() + participants.length + 1),
    id: crypto.randomUUID(),
    metadata: modMetadata,
    participantId: null,
    parts: modParts,
    role: 'assistant',
    roundNumber: 0,
    threadId,
  });

  // Round execution record
  const insertRoundExecution = db.insert(roundExecution).values({
    attempts: 1,
    createdAt: now,
    id: crypto.randomUUID(),
    participantsCompleted: participants.length,
    participantsTotal: participants.length,
    roundNumber: 0,
    status: 'completed',
    threadId,
    updatedAt: now,
    userId,
  });

  // Execute all as atomic batch (D1 does NOT support db.transaction()).
  // First element explicit for tuple type satisfaction [BatchItem, ...BatchItem[]].
  const remainingOps = [
    ...insertParticipants,
    insertUserMessage,
    ...insertParticipantMessages,
    insertModeratorMessage,
    insertRoundExecution,
  ];
  await db.batch([insertThread, ...remainingOps]);

  return { threadId, threadSlug };
}
