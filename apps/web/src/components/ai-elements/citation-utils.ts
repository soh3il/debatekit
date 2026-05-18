/**
 * Citation Utility Functions
 *
 * Extracted from inline-citation.tsx for better code organization
 * and to satisfy react-refresh/only-export-components lint rule.
 */

import type { CitationSourceType } from '@debatekit/shared';
import { CitationSourceTypes } from '@debatekit/shared';

/**
 * Extract hostname from URL for display purposes
 * Removes 'www.' prefix for cleaner display
 */
export function extractHostname(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Optional source data for richer display labels
 * When provided, the function will prefer real data over generic labels
 */
export type SourceDisplayData = {
  /** Display title for the source */
  title?: string;
  /** Original filename for attachments */
  filename?: string;
  /** Domain/hostname for web sources */
  domain?: string;
};

/**
 * Detect generic/placeholder titles that should be skipped in favor of better alternatives.
 * These patterns indicate the backend couldn't find a meaningful title.
 */
const GENERIC_TITLE_PATTERNS = [
  /^(web )?search results?\s*#?\d*$/i,
  /^results?\s*#?\d*$/i,
  /^untitled$/i,
  /^no title$/i,
  /^unknown$/i,
  /^source\s*#?\d*$/i,
  /^\s*$/,
];

function isGenericTitle(title: string | undefined): boolean {
  if (!title || title.trim().length === 0) {
    return true;
  }
  return GENERIC_TITLE_PATTERNS.some(pattern => pattern.test(title.trim()));
}

/**
 * Format citation ID for human-readable display
 * Converts internal citation IDs to user-friendly labels
 *
 * Fallback chain (in priority order):
 * 1. title (if provided and non-empty)
 * 2. filename (if provided and non-empty)
 * 3. domain (if provided and non-empty)
 * 4. Pattern-parsed ID (e.g., "sch_q0r1" → "Web Search Result #2")
 * 5. Generic label based on source type (e.g., "Attached File")
 *
 * IMPORTANT: This function should NEVER return raw citation IDs like "thd_01KG" or "att_abc123".
 * It must always return a human-readable label for the given source type.
 */
export function formatCitationIdForDisplay(
  citationId: string,
  sourceType: CitationSourceType,
  sourceData?: SourceDisplayData,
): string {
  // Priority 1: Use title if available, non-empty, and NOT a generic placeholder
  // Skip generic titles like "Search Result #1" that indicate backend couldn't find real title
  if (sourceData?.title && sourceData.title.trim() && !isGenericTitle(sourceData.title)) {
    return sourceData.title.trim();
  }

  // Priority 2: Use filename if available and non-empty
  if (sourceData?.filename && sourceData.filename.trim()) {
    return sourceData.filename.trim();
  }

  // Priority 3: Use domain if available and non-empty
  if (sourceData?.domain && sourceData.domain.trim()) {
    return sourceData.domain.trim();
  }

  // Priority 4 & 5: Pattern-parsed ID or generic label based on source type

  // Parse search citations like "sch_q0r1" → "Search Result #2"
  // Also handles general search citations that don't match the pattern
  if (sourceType === CitationSourceTypes.SEARCH) {
    const match = citationId.match(/^sch_q(\d+)r(\d+)$/);
    if (match) {
      const resultNum = Number.parseInt(match[2] ?? '0', 10) + 1;
      return `Web Search Result #${resultNum}`;
    }
    // Fallback for search citations that don't match the pattern
    return 'Web Search Result';
  }

  // Parse memory citations like "mem_abc123" → "Memory"
  if (sourceType === CitationSourceTypes.MEMORY) {
    return 'Project Memory';
  }

  // Parse thread citations - always return friendly name, never raw ID
  if (sourceType === CitationSourceTypes.THREAD) {
    return 'Previous Conversation';
  }

  // Parse moderator citations like "mod_round0" → "Round Summary"
  if (sourceType === CitationSourceTypes.MODERATOR) {
    const match = citationId.match(/^mod_round(\d+)/);
    if (match) {
      const roundNum = Number.parseInt(match[1] ?? '0', 10) + 1;
      return `Round ${roundNum} Summary`;
    }
    // Fallback for moderator citations that don't match the pattern
    return 'Discussion Summary';
  }

  // Parse RAG citations
  if (sourceType === CitationSourceTypes.RAG) {
    return 'Indexed Document';
  }

  // Parse attachment citations - always return friendly name, never raw ID
  if (sourceType === CitationSourceTypes.ATTACHMENT) {
    return 'Attached File';
  }

  // Domain citations (e.g., SEC EDGAR, Finnhub, FRED, ClinicalTrials.gov)
  if (sourceType === CitationSourceTypes.DOMAIN) {
    return 'Data Source';
  }

  // Ultimate fallback - should never reach here since all CitationSourceType values
  // are handled above, but provides safety net in case new types are added
  return 'Source';
}
