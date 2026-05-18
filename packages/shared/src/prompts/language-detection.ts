/**
 * Heuristic Language Detection — Shared between API and MCP
 *
 * Extracted from apps/api/src/services/prompts/language-detection.ts
 * Instant Unicode script detection for non-Latin scripts.
 * No LLM needed — sufficient for Persian, Chinese, Japanese, Korean, Russian, etc.
 */

import type { DetectedLanguage } from './council-prompts';

// Unicode script ranges for heuristic detection
export const SCRIPT_PATTERNS = [
  { language: 'Persian/Farsi', pattern: /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/ },
  { language: 'Chinese', pattern: /[\u4E00-\u9FFF\u3400-\u4DBF]/ },
  { language: 'Japanese', pattern: /[\u3040-\u309F\u30A0-\u30FF]/ },
  { language: 'Korean', pattern: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
  { language: 'Russian', pattern: /[\u0400-\u04FF]/ },
  { language: 'Thai', pattern: /[\u0E00-\u0E7F]/ },
  { language: 'Hindi', pattern: /[\u0900-\u097F]/ },
  { language: 'Bengali', pattern: /[\u0980-\u09FF]/ },
  { language: 'Tamil', pattern: /[\u0B80-\u0BFF]/ },
  { language: 'Hebrew', pattern: /[\u0590-\u05FF]/ },
  { language: 'Georgian', pattern: /[\u10A0-\u10FF]/ },
  { language: 'Armenian', pattern: /[\u0530-\u058F]/ },
  { language: 'Greek', pattern: /[\u0370-\u03FF]/ },
] as const;

// Minimum non-ASCII character ratio to consider non-Latin script dominant
const SCRIPT_THRESHOLD = 0.15;

/**
 * Fast heuristic: detect non-Latin script languages via Unicode ranges.
 * Returns language name if non-Latin script detected, 'latin' if Latin-based,
 * or null if it looks like plain English.
 *
 * For MCP: call this and pass the result to buildParticipantSystemPrompt().
 * For API: used as first step before optional LLM fallback.
 */
export function detectScriptHeuristic(text: string): DetectedLanguage | 'latin' {
  // Strip whitespace/punctuation for character analysis
  const chars = text.replace(/[\s\p{P}\p{S}\d]/gu, '');
  if (chars.length === 0) {
    return null;
  }

  for (const { language, pattern } of SCRIPT_PATTERNS) {
    const matches = chars.match(new RegExp(pattern.source, 'g'));
    if (matches && matches.length / chars.length >= SCRIPT_THRESHOLD) {
      return language;
    }
  }

  // Check if text is predominantly ASCII (likely English or Latin-script language)
  // eslint-disable-next-line no-control-regex
  const asciiChars = chars.replace(/[^\x00-\x7F]/g, '');
  if (asciiChars.length / chars.length > 0.9) {
    // Could be English or another Latin-script language — need LLM to differentiate
    return 'latin';
  }

  return null;
}

/**
 * Simple language detection for MCP (no LLM fallback).
 * Returns detected language name or null for English/Latin.
 *
 * For non-Latin scripts (Persian, Chinese, Japanese, etc.), this is
 * instant and accurate. For Latin-script non-English (Spanish, French),
 * returns null (no language enforcement) — acceptable trade-off for MCP.
 */
export function detectLanguageHeuristic(text: string): DetectedLanguage {
  const result = detectScriptHeuristic(text);
  // For MCP: 'latin' means we can't tell without LLM, so skip enforcement
  if (result === 'latin') {
    return null;
  }
  return result;
}
