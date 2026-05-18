/**
 * !help Command
 *
 * Sends welcome and usage information.
 */

import type { Env } from '../index';
import { formatHelp } from '../formatting/result-formatter';
import { sendTextMessage } from '../lib/whatsapp-client';

export async function handleHelp(env: Env, to: string, replyMessageId: string) {
  const text = formatHelp(env.DEBATEKIT_APP_URL);
  await sendTextMessage(env.WHATSAPP_ACCESS_TOKEN, env.WHATSAPP_PHONE_NUMBER_ID, to, text, replyMessageId);
}
