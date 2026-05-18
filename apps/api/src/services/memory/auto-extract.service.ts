/**
 * Auto-Extract Memory Service
 *
 * Analyzes user messages to extract memorable facts, preferences, and instructions.
 * Runs in background (non-streaming) using a fast model. Updates project-scoped
 * working memory via DrizzleProvider when new information is found.
 */

import type { DrizzleProvider } from '@ai-sdk-tools/memory/drizzle';
import { MessagePartTypes, UIMessageRoles } from '@debatekit/shared/enums';

import type { conversationMessages } from '@/db/tables/conversation-messages';
import type { workingMemory } from '@/db/tables/working-memory';
import { openRouterService } from '@/services/models/openrouter.service';
import type { TypedLogger } from '@/types/logger';
import { LogHelpers } from '@/types/logger';

type MemoryProvider = DrizzleProvider<typeof workingMemory, typeof conversationMessages>;

const EXTRACT_MODEL = 'openai/gpt-4o-mini';
const EXTRACT_MAX_TOKENS = 512;

const EXTRACT_SYSTEM_PROMPT = `You are a memory extraction assistant. Analyze the user message and determine if it contains facts, preferences, instructions, or context that should be remembered for future conversations.

Rules:
- Extract ONLY concrete, actionable information (names, preferences, technical context, project requirements, communication style preferences)
- Do NOT extract greetings, pleasantries, or generic conversation
- Do NOT extract information that is only relevant to the current message/question
- If existing memory already contains the information, skip it
- If new information contradicts existing memory, the new information takes priority

If there IS something to remember:
- Return a brief summary of what was extracted (1-2 sentences)
- The summary should describe WHAT changed, not repeat the full content

If there is NOTHING to remember:
- Return exactly: NONE`;

export async function extractMemoryFromPrompt({
  existingMemory,
  logger,
  projectId,
  provider,
  userMessage,
}: {
  existingMemory: string | null;
  logger?: TypedLogger;
  projectId: string;
  provider: MemoryProvider;
  userMessage: string;
}) {
  try {
    const promptText = existingMemory
      ? `Existing memory:\n${existingMemory}\n\nNew user message:\n${userMessage}`
      : `No existing memory.\n\nNew user message:\n${userMessage}`;

    const result = await openRouterService.generateText({
      maxTokens: EXTRACT_MAX_TOKENS,
      messages: [
        {
          id: 'msg-memory-extract',
          parts: [{ text: promptText, type: MessagePartTypes.TEXT }],
          role: UIMessageRoles.USER,
        },
      ],
      modelId: EXTRACT_MODEL,
      system: EXTRACT_SYSTEM_PROMPT,
      temperature: 0.1,
    });

    const responseText = result.text.trim();

    if (responseText === 'NONE' || !responseText) {
      logger?.info('No memorable content found in message', LogHelpers.operation({
        operationName: 'extractMemoryFromPrompt',
        projectId,
      }));
      return { extracted: false, previousContent: null, summary: null };
    }

    // Store the previous content for undo
    const previousContent = existingMemory;

    // Build updated memory content
    const updatedContent = existingMemory
      ? `${existingMemory}\n${responseText}`
      : responseText;

    await provider.updateWorkingMemory({
      chatId: projectId,
      content: updatedContent,
      scope: 'chat',
    });

    logger?.info('Extracted and saved memory from user message', LogHelpers.operation({
      operationName: 'extractMemoryFromPrompt',
      projectId,
    }));

    return { extracted: true, previousContent, summary: responseText };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logger?.warn('Failed to extract memory from prompt', LogHelpers.operation({
      error: errMsg,
      operationName: 'extractMemoryFromPrompt',
      projectId,
    }));
    return { extracted: false, previousContent: null, summary: null };
  }
}
