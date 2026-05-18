/**
 * !setkey Command
 *
 * Configures the DebateKit API key for the current chat.
 * Validates the key format (must start with rpnd_).
 */

import type { Env } from '../index';
import { setApiKey } from '../lib/chat-store';
import { sendTextMessage } from '../lib/whatsapp-client';

export async function handleSetKey(env: Env, chatId: string, to: string, replyMessageId: string, args: string) {
  const key = args.trim();

  if (!key) {
    await sendTextMessage(
      env.WHATSAPP_ACCESS_TOKEN,
      env.WHATSAPP_PHONE_NUMBER_ID,
      to,
      `*Usage:* !setkey rpnd_your_api_key\n\nGet a key at ${env.DEBATEKIT_APP_URL}/chat/settings/api-keys`,
      replyMessageId,
    );
    return;
  }

  if (!key.startsWith('rpnd_')) {
    await sendTextMessage(
      env.WHATSAPP_ACCESS_TOKEN,
      env.WHATSAPP_PHONE_NUMBER_ID,
      to,
      `*Invalid key format.* API keys must start with \`rpnd_\`.\n\nGet a key at ${env.DEBATEKIT_APP_URL}/chat/settings/api-keys`,
      replyMessageId,
    );
    return;
  }

  await setApiKey(env.KV, chatId, key);

  const masked = `${key.slice(0, 8)}...${key.slice(-4)}`;
  await sendTextMessage(
    env.WHATSAPP_ACCESS_TOKEN,
    env.WHATSAPP_PHONE_NUMBER_ID,
    to,
    `*API key configured!*\n\nKey: \`${masked}\`\n\nYou can now use DebateKit. Try sending a question or use !consult.`,
    replyMessageId,
  );
}
