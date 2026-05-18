/**
 * Working Memory Service
 *
 * Uses @ai-sdk-tools/memory DrizzleProvider for persistence and the library's
 * built-in formatWorkingMemory() for prompt injection.
 * Delegates all CRUD to the provider — no custom Drizzle queries.
 *
 * Project-scoped memory via chatId=projectId (scope='chat').
 * No per-user or per-thread memory — only project-level.
 */

import {
  formatWorkingMemory,
} from '@ai-sdk-tools/memory';
import { DrizzleProvider } from '@ai-sdk-tools/memory/drizzle';

import type { getDbAsync } from '@/db';
import { conversationMessages } from '@/db/tables/conversation-messages';
import { workingMemory } from '@/db/tables/working-memory';
import type { TypedLogger } from '@/types/logger';
import { LogHelpers } from '@/types/logger';

type Db = Awaited<ReturnType<typeof getDbAsync>>;

/**
 * Create a DrizzleProvider instance for working memory operations.
 *
 * Uses the library's DrizzleProvider with our workingMemory table and a minimal
 * conversationMessages table (required by constructor, not used for message storage).
 */
export function createMemoryProvider(db: Db) {
  return new DrizzleProvider(db, {
    messagesTable: conversationMessages,
    workingMemoryTable: workingMemory,
  });
}

/**
 * Load project-scoped working memory and format for system prompt injection.
 *
 * Uses chatId=projectId with scope='chat' to get project-level memory.
 * Returns formatted prompt string or undefined.
 */
export async function loadWorkingMemoryForPrompt({
  logger,
  projectId,
  provider,
}: {
  logger?: TypedLogger;
  projectId: string;
  provider: DrizzleProvider<typeof workingMemory, typeof conversationMessages>;
}) {
  try {
    const chatMemory = await provider.getWorkingMemory({ chatId: projectId, scope: 'chat' });

    if (!chatMemory) {
      return { formattedPrompt: undefined };
    }

    const formattedPrompt = formatWorkingMemory(chatMemory);

    logger?.info('Loaded working memory for prompt', LogHelpers.operation({
      operationName: 'loadWorkingMemoryForPrompt',
      projectId,
    }));

    return { formattedPrompt };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logger?.warn('Failed to load working memory', LogHelpers.operation({
      error: errMsg,
      operationName: 'loadWorkingMemoryForPrompt',
      projectId,
    }));
    return { formattedPrompt: undefined };
  }
}
