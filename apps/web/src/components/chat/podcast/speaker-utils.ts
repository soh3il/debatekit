/**
 * Speaker Utilities
 *
 * Resolves provider icons from podcast speaker names.
 * Speaker names follow patterns like "Claude Opus 4.6 (The Critic)" or "GPT-5".
 */

import { BRAND } from '@/constants/brand';
import { getProviderIcon } from '@/lib/utils/ai-display';

/**
 * Known model name prefixes mapped to provider keys.
 * Order matters — check more specific patterns first.
 */
const SPEAKER_PROVIDER_PATTERNS: [RegExp, string][] = [
  [/\bclaude\b/i, 'anthropic'],
  [/\bgpt\b/i, 'openai'],
  [/\bo[1-9]\b/i, 'openai'],
  [/\bgemini\b/i, 'google'],
  [/\bgrok\b/i, 'xai'],
  [/\bdeepseek\b/i, 'deepseek'],
  [/\bmistral\b/i, 'mistralai'],
  [/\bllama\b/i, 'meta-llama'],
  [/\bqwen\b/i, 'qwen'],
  [/\bkimi\b/i, 'moonshotai'],
];

/**
 * Guess the AI provider from a speaker name string.
 * Returns the provider key or null if no match.
 */
export function guessProviderFromSpeakerName(name: string): string | null {
  for (const [pattern, provider] of SPEAKER_PROVIDER_PATTERNS) {
    if (pattern.test(name)) {
      return provider;
    }
  }
  return null;
}

/**
 * Get the provider icon URL for a speaker name.
 * Council Moderator gets the DebateKit brand logo.
 * Narrator gets the OpenRouter logo.
 * Participants get their AI provider's icon.
 */
export function getSpeakerProviderIcon(speakerName: string): string {
  const lower = speakerName.toLowerCase();
  // Council Moderator gets the DebateKit brand logo
  if (lower === 'council moderator' || lower === 'moderator') {
    return BRAND.logos.main;
  }
  // Narrator gets the OpenRouter logo (not the brand logo)
  if (lower === 'narrator') {
    return getProviderIcon('openrouter');
  }

  const provider = guessProviderFromSpeakerName(speakerName);
  return getProviderIcon(provider ?? 'openrouter');
}
