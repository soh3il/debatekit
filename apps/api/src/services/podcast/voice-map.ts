/**
 * Podcast Voice Map
 *
 * ElevenLabs voice mappings per AI model ID.
 * Each model gets a distinct voice for multi-speaker podcast dialogue.
 * Fallback pool with round-robin for unmapped models.
 */

import { ModelIds } from '@debatekit/shared/enums';

// ============================================================================
// VOICE DEFINITIONS
// ============================================================================

/**
 * Narrator voice - used for the host/MC who introduces speakers and manages flow.
 * "Rachel" - clear, authoritative female narrator voice.
 */
export const NARRATOR_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

/**
 * Council Moderator voice - used for the moderator's actual opinion/synthesis.
 * "Clyde" - distinct male voice to differentiate from the narrator.
 */
export const MODERATOR_VOICE_ID = '2EiwWnXFnvU5JabPnv8n';

/**
 * Primary model-to-voice mappings.
 * Each key model gets a unique, distinguishable ElevenLabs voice.
 */
const MODEL_VOICE_MAP: ReadonlyMap<string, string> = new Map([
  // Anthropic voices
  [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, 'pNInz6obpgDQGcFmaJgB'], // Adam
  [ModelIds.ANTHROPIC_CLAUDE_OPUS_4, 'pNInz6obpgDQGcFmaJgB'], // Adam
  [ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, 'ErXwobaYiN019PkySvjV'], // Antoni
  [ModelIds.ANTHROPIC_CLAUDE_SONNET_4, 'ErXwobaYiN019PkySvjV'], // Antoni
  [ModelIds.ANTHROPIC_CLAUDE_HAIKU_4_5, 'VR6AewLTigWG4xSOukaG'], // Arnold

  // OpenAI voices
  [ModelIds.OPENAI_GPT_5_2, 'EXAVITQu4vr4xnSDxMaL'], // Bella
  [ModelIds.OPENAI_GPT_5_1, 'EXAVITQu4vr4xnSDxMaL'], // Bella
  [ModelIds.OPENAI_GPT_5, 'EXAVITQu4vr4xnSDxMaL'], // Bella
  [ModelIds.OPENAI_GPT_5_MINI, 'MF3mGyEYCl7XYWbV9V6O'], // Elli
  [ModelIds.OPENAI_GPT_5_NANO, 'TxGEqnHWrfWFTfGW9XjX'], // Josh
  [ModelIds.OPENAI_GPT_4_1, 'AZnzlk1XvdvUeBnXmlld'], // Domi
  [ModelIds.OPENAI_GPT_4_1_MINI, 'MF3mGyEYCl7XYWbV9V6O'], // Elli
  [ModelIds.OPENAI_GPT_4_1_NANO, 'TxGEqnHWrfWFTfGW9XjX'], // Josh
  [ModelIds.OPENAI_GPT_4O_MINI, 'MF3mGyEYCl7XYWbV9V6O'], // Elli
  [ModelIds.OPENAI_O3, 'jsCqWAovK2LkecY7zXl4'], // Freya
  [ModelIds.OPENAI_O3_MINI, 'TxGEqnHWrfWFTfGW9XjX'], // Josh
  [ModelIds.OPENAI_O4_MINI, 'TxGEqnHWrfWFTfGW9XjX'], // Josh
  [ModelIds.OPENAI_O3_PRO, 'jsCqWAovK2LkecY7zXl4'], // Freya
  [ModelIds.OPENAI_GPT_OSS_120B, 'oWAxZDx7w5VEj9dCyTzz'], // Grace

  // Google voices
  [ModelIds.GOOGLE_GEMINI_2_5_PRO, 'onwK4e9ZLuTAKqWW03F9'], // Daniel
  [ModelIds.GOOGLE_GEMINI_2_5_FLASH, 'ZQe5CZNOzWyzPSCn5a3c'], // James
  [ModelIds.GOOGLE_GEMINI_3_1_PRO_PREVIEW, 'onwK4e9ZLuTAKqWW03F9'], // Daniel
  [ModelIds.GOOGLE_GEMINI_3_FLASH_PREVIEW, 'ZQe5CZNOzWyzPSCn5a3c'], // James

  // xAI voices
  [ModelIds.X_AI_GROK_4, 'yoZ06aMxZJJ28mfd3POQ'], // Sam
  [ModelIds.X_AI_GROK_4_FAST, 'yoZ06aMxZJJ28mfd3POQ'], // Sam
  [ModelIds.X_AI_GROK_4_1_FAST, 'yoZ06aMxZJJ28mfd3POQ'], // Sam
  [ModelIds.X_AI_GROK_3, 'g5CIjZEefAph4nQFvHAz'], // Ethan
  [ModelIds.X_AI_GROK_CODE_FAST_1, 'g5CIjZEefAph4nQFvHAz'], // Ethan

  // DeepSeek voices
  [ModelIds.DEEPSEEK_DEEPSEEK_V3_2, 'ThT5KcBeYPX3keUQqHPh'], // Dorothy

  // Mistral voices
  [ModelIds.MISTRALAI_MISTRAL_LARGE_2512, 'GBv7mTt0atIp3Br8iCZE'], // Thomas
]);

/**
 * Fallback voice pool for models not in the primary map.
 * Also used to remap duplicate voices when model variants share the same voice.
 */
export const FALLBACK_VOICE_POOL = [
  'SOYHLrjzK2X1ezoPC6cr', // Harry
  'flq6f7yk4E4fJM5XTYuZ', // Michael
  'IKne3meq5aSn9XLyUdCD', // Charlie
  'N2lVS1w4EtoT3dr4eOWO', // Callum
  'TX3LPaxmHKxFdv7VOQHJ', // Liam
  'XB0fDUnXU5powFXDhCwa', // Charlotte
  'bIHbv24MWmeRgasZH58o', // Will
  'nPczCjzI2devNBz1zQrb', // Brian
] as const;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get the ElevenLabs voice ID for a given AI model.
 * Falls back to round-robin pool if model has no dedicated voice.
 *
 * @param modelId - The AI model identifier (e.g. 'openai/gpt-5')
 * @param fallbackIndex - Index into the fallback pool for round-robin (default 0)
 * @returns ElevenLabs voice ID string
 */
export function getVoiceForModel(modelId: string, fallbackIndex = 0): string {
  const mapped = MODEL_VOICE_MAP.get(modelId);
  if (mapped) {
    return mapped;
  }

  // Round-robin through the fallback pool
  const poolIndex = Math.abs(fallbackIndex) % FALLBACK_VOICE_POOL.length;
  return FALLBACK_VOICE_POOL[poolIndex] ?? FALLBACK_VOICE_POOL[0];
}

/**
 * Get the narrator (host/MC) voice ID.
 */
export function getNarratorVoice(): string {
  return NARRATOR_VOICE_ID;
}

/**
 * Get the council moderator voice ID.
 */
export function getModeratorVoice(): string {
  return MODERATOR_VOICE_ID;
}
