import { CitationSourcePrefixes, CitationSourceTypes } from '@debatekit/shared/enums';

import { isPreSearchMessageMetadata } from '@/db/schemas/chat-metadata';
import type { ChatMessage } from '@/db/validation';
import { getRoundNumber } from '@/lib/utils';
import type { SearchContextOptions, ValidatedPreSearchData } from '@/routes/chat/schema';
import {
  ValidatedPreSearchDataSchema,
} from '@/routes/chat/schema';
import { filterDbToPreSearchMessages } from '@/services/messages';
import type { CitableSource, CitationSourceMap } from '@/types/citations';

/**
 * Result from building search context with citation support
 */
export type SearchContextResult = {
  formattedPrompt: string;
  citableSources: CitableSource[];
  sourceMap: CitationSourceMap;
};

/**
 * Generate a citation ID for a search result
 */
function generateSearchCitationId(queryIndex: number, resultIndex: number): string {
  const uniqueId = `q${queryIndex}r${resultIndex}`;
  return `${CitationSourcePrefixes[CitationSourceTypes.SEARCH]}_${uniqueId}`;
}

// Generic titles that indicate poor metadata
const GENERIC_TITLE_PATTERNS = [
  /^search result \d+$/i,
  /^untitled$/i,
  /^result \d+$/i,
  /^no title$/i,
  /^unknown$/i,
  /^\s*$/,
];

function isGenericTitle(title: string | undefined | null): boolean {
  if (!title || title.trim().length === 0) {
    return true;
  }
  return GENERIC_TITLE_PATTERNS.some(pattern => pattern.test(title.trim()));
}

/**
 * Extract readable path from URL for fallback title.
 * Example: "https://example.com/article/my-article-title" → "My Article Title"
 */
function extractReadableUrlPath(url: string | undefined | null): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.split('/').filter(Boolean).pop();
    if (!path || path === 'index.html' || path === 'index') {
      return null;
    }
    // Convert kebab-case and snake_case to title case
    const readable = path
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/[-_]/g, ' ') // Convert separators to spaces
      .replace(/\b\w/g, c => c.toUpperCase()) // Title case
      .trim();
    return readable.length > 3 ? readable : null;
  } catch {
    return null;
  }
}

/**
 * Get the best available title for a search result.
 * Priority: valid title > description (truncated) > readable URL path > domain > generic
 */
function getBestTitle(
  result: { title?: string | null; domain?: string | null; url?: string | null; metadata?: { description?: string | null } | null },
  resultIndex: number,
): string {
  // 1. Check if title exists and is not generic
  if (result.title && !isGenericTitle(result.title)) {
    return result.title;
  }

  // 2. Use description if available (truncate for display)
  const description = result.metadata?.description;
  if (description && description.trim().length > 10) {
    const truncated = description.trim().slice(0, 60);
    return truncated.length < description.trim().length ? `${truncated}...` : truncated;
  }

  // 3. Extract readable path from URL
  const readablePath = extractReadableUrlPath(result.url);
  if (readablePath) {
    return readablePath;
  }

  // 4. Use domain with "Article from" prefix
  if (result.domain) {
    return `Article from ${result.domain}`;
  }

  // 5. Last resort: generic but with better format
  return `Web Search Result #${resultIndex + 1}`;
}

/**
 * Build search context directly from presearch data without DB message transformation.
 *
 * ✅ FIX: Use this instead of buildSearchContextWithCitations when you have raw presearch data.
 * The old approach transformed ValidatedPreSearchData → DbPreSearchData (losing rawContent, excerpt, etc.)
 * → ChatMessage → re-validated against ValidatedPreSearchDataSchema (which failed due to missing fields).
 *
 * This function works directly with ValidatedPreSearchData, preserving all fields including
 * rawContent (extracted web page content) that participants need to answer questions.
 */
export function buildDirectSearchContext(
  preSearchData: ValidatedPreSearchData,
  _roundNumber: number,
): SearchContextResult {
  const citableSources: CitableSource[] = [];
  const sourceMap: CitationSourceMap = new Map();

  // Build context with citations using the validated data directly
  const result = buildCurrentRoundSearchContextWithCitations(preSearchData);

  // Add sources to collections
  for (const source of result.sources) {
    citableSources.push(source);
    sourceMap.set(source.id, source);
  }

  // ✅ PERF: Use array collect pattern instead of string += (O(n) vs O(n²))
  const contextParts: string[] = ['\n\n## Web Search Context\n\n'];

  // Add upfront citation reminder before the search results
  contextParts.push(
    '**IMPORTANT: You MUST cite sources using the exact [sch_q#r#] IDs shown in each result header below (e.g., [sch_q0r0], [sch_q0r1]).**\n\n',
  );

  contextParts.push(result.content);

  // Add concise citation instructions if there are citable sources
  if (citableSources.length > 0) {
    const sourceList = citableSources
      .slice(0, 10)
      .map((s, i) => `  ${i + 1}. "${s.title}" → [${s.id}]`)
      .join('\n');

    contextParts.push(
      '\n---\n\n',
      '## Citation Requirements\n\n',
      'Cite sources inline using the [sch_q#r#] IDs from the result headers above.\n',
      'Place the citation immediately after the fact it supports.\n\n',
      'Available sources:\n',
      sourceList,
      '\n\n',
      'Example: "Bitcoin is predicted to reach $100K [sch_q0r0]."\n\n',
    );
  }

  const formattedPrompt = contextParts.join('');

  return { citableSources, formattedPrompt, sourceMap };
}

/**
 * Build search context with citation support
 * Returns both the formatted prompt and citable sources for the source map
 */
export function buildSearchContextWithCitations(
  allMessages: ChatMessage[],
  options: SearchContextOptions,
): SearchContextResult {
  const citableSources: CitableSource[] = [];
  const sourceMap: CitationSourceMap = new Map();

  const preSearchMessages = filterDbToPreSearchMessages(allMessages);

  if (preSearchMessages.length === 0) {
    return { citableSources, formattedPrompt: '', sourceMap };
  }

  const { currentRoundNumber, includeFullResults = true } = options;

  // ✅ PERF: Use array collect pattern instead of string += (O(n) vs O(n²))
  const contextParts: string[] = ['\n\n## Web Search Context\n\n'];

  // Add upfront citation reminder before the search results
  contextParts.push(
    '**IMPORTANT: You MUST cite sources using the exact [sch_q#r#] IDs shown in each result header below (e.g., [sch_q0r0], [sch_q0r1]).**\n\n',
  );

  for (const preSearchMsg of preSearchMessages) {
    const validatedData = extractValidatedPreSearchData(preSearchMsg);
    if (!validatedData) {
      continue;
    }

    const msgRoundNumber = getRoundNumber(preSearchMsg.metadata) || 0;
    const isCurrentRound = msgRoundNumber === currentRoundNumber;

    if (isCurrentRound && includeFullResults) {
      const result = buildCurrentRoundSearchContextWithCitations(validatedData);
      contextParts.push(result.content);

      // Add sources to collections
      for (const source of result.sources) {
        citableSources.push(source);
        sourceMap.set(source.id, source);
      }
    } else {
      const prevContent = buildPreviousRoundSearchContext(msgRoundNumber, validatedData);
      contextParts.push(prevContent);
    }
  }

  // Add citation instructions if there are citable sources
  if (citableSources.length > 0) {
    // Build numbered source list for clarity
    const sourceList = citableSources
      .slice(0, 10)
      .map((s, i) => `  ${i + 1}. "${s.title}" → cite as **[${s.id}]**`)
      .join('\n');

    // Extract a real content snippet for the example if available
    const firstSource = citableSources[0];
    const firstSourceSnippet = firstSource?.content?.slice(0, 80)?.replace(/\n/g, ' ') || 'relevant information';
    const firstSourceDomain = firstSource?.metadata?.domain || 'the source';
    const firstSourceId = firstSource?.id || 'sch_q0r0';

    // Get a second source for variety in examples
    const secondSource = citableSources[1];
    const secondSourceId = secondSource?.id || 'sch_q0r1';
    const secondSourceTitle = secondSource?.title?.slice(0, 50) || 'another source';

    contextParts.push(
      '\n---\n\n',
      '## 🚨 CITATION REQUIREMENTS - READ CAREFULLY\n\n',
      '**CRITICAL: Every fact, statistic, date, name, or claim from the search results above MUST include a citation.**\n\n',
      '### Your Available Sources:\n',
      sourceList,
      '\n\n',
      '### Citation Format (REQUIRED):\n\n',
      '**Format:** `[sch_q#r#]` where # = query index and result index (e.g., q0r0 = first query, first result)\n\n',
      `**Example IDs from this search:** ${firstSourceId}, ${secondSourceId}\n\n`,
      '### How to Cite Correctly:\n\n',
      '**Rule 1:** Place the citation IMMEDIATELY after the information from that source.\n\n',
      '**Rule 2:** Be specific about WHAT you are citing.\n\n',
      '✅ **CORRECT Examples:**\n',
      `- "According to ${firstSourceDomain}, ${firstSourceSnippet}... [${firstSourceId}]."\n`,
      `- "The article '${secondSourceTitle}' explains that... [${secondSourceId}]."\n`,
      '- "Research shows a 25% increase in performance [sch_q0r0], while costs decreased by 10% [sch_q0r1]."\n\n',
      '❌ **WRONG Examples (NEVER do this):**\n',
      '- "The data shows a 25% increase." ← **NO CITATION - REJECTED**\n',
      '- "According to sources, it improved." ← **TOO VAGUE - REJECTED**\n',
      '- "Based on my research, the answer is X." ← **NOT CITING SPECIFIC SOURCE - REJECTED**\n\n',
      '### Final Reminder:\n\n',
      '**If you state ANY information from the web search results, you MUST add the citation ID (e.g., [sch_q0r0]) after it.**\n',
      '**A response without proper citations is INCOMPLETE and will be considered a failure.**\n\n',
    );
  }

  const formattedPrompt = contextParts.join('');

  return { citableSources, formattedPrompt, sourceMap };
}

/**
 * Build current round search context with citation markers
 * Returns both formatted content and citable sources
 */
function buildCurrentRoundSearchContextWithCitations(
  preSearch: ValidatedPreSearchData,
): { content: string; sources: CitableSource[] } {
  const sources: CitableSource[] = [];
  // ✅ PERF: Use array collect pattern instead of string += (O(n) vs O(n²))
  const parts: string[] = [
    '### Web Search Results\n\n',
    'Cite each fact using the [sch_q#r#] ID in the result header.\n\n',
  ];

  let queryIndex = 0;
  for (const searchResult of preSearch.results) {
    parts.push(`---\n**Search Query:** "${searchResult.query}"\n\n`);
    for (let resultIndex = 0; resultIndex < searchResult.results.length; resultIndex++) {
      const result = searchResult.results[resultIndex];
      if (!result) {
        continue;
      }

      const citationId = generateSearchCitationId(queryIndex, resultIndex);
      const rawData = result.rawContent || result.fullContent || result.content || result.excerpt || '';

      sources.push({
        content: rawData.slice(0, 500),
        id: citationId,
        metadata: {
          author: result.metadata?.author ?? undefined,
          description: result.metadata?.description ?? undefined,
          domain: result.domain ?? undefined,
          publishedDate: result.publishedDate ?? undefined,
          query: searchResult.query,
          readingTime: result.metadata?.readingTime ?? undefined,
          url: result.url,
          wordCount: result.metadata?.wordCount ?? undefined,
        },
        sourceId: `${queryIndex}_${resultIndex}`,
        title: getBestTitle(result, resultIndex),
        type: CitationSourceTypes.SEARCH,
      });

      // Build context with citation ID - use same best title logic
      const displayTitle = getBestTitle(result, resultIndex);
      parts.push(`#### [${citationId}] ${displayTitle}\n`);
      parts.push(`**URL:** ${result.url}\n`);
      if (result.domain) {
        parts.push(`**Domain:** ${result.domain}\n`);
      }
      if (result.publishedDate) {
        parts.push(`**Published:** ${result.publishedDate}\n`);
      }

      if (result.metadata) {
        const meta: string[] = [];
        if (result.metadata.author) {
          meta.push(`Author: ${result.metadata.author}`);
        }
        if (result.metadata.wordCount) {
          meta.push(`${result.metadata.wordCount.toLocaleString()} words`);
        }
        if (result.metadata.readingTime) {
          meta.push(`${result.metadata.readingTime} min read`);
        }
        if (result.metadata.description) {
          meta.push(`Description: ${result.metadata.description}`);
        }
        if (meta.length > 0) {
          parts.push(`**Metadata:** ${meta.join(' | ')}\n`);
        }
      }

      if (rawData) {
        parts.push('\n**Content:**\n```\n', rawData, '\n```\n');
        parts.push(`*(Cite this content as [${citationId}])*\n\n`);
      }
    }
    queryIndex++;
  }

  parts.push('---\n\n');

  return { content: parts.join(''), sources };
}

function extractValidatedPreSearchData(
  message: ChatMessage,
): ValidatedPreSearchData | null {
  if (!message.metadata) {
    return null;
  }

  if (!isPreSearchMessageMetadata(message.metadata)) {
    return null;
  }

  // ✅ FIX: Use ValidatedPreSearchDataSchema instead of DbPreSearchDataSchema
  // ValidatedPreSearchDataSchema includes rawContent, fullContent, metadata, etc.
  // DbPreSearchDataSchema was missing these fields, causing data loss
  const validation = ValidatedPreSearchDataSchema.safeParse(message.metadata.preSearch);
  if (!validation.success) {
    return null;
  }

  return validation.data;
}

function buildPreviousRoundSearchContext(
  roundNumber: number,
  preSearch: ValidatedPreSearchData,
): string {
  // ✅ PERF: Use array collect pattern instead of string += (O(n) vs O(n²))
  const parts: string[] = [`### Round ${roundNumber + 1} Search Summary (internal: ${roundNumber})\n\n`];

  if (preSearch.summary) {
    parts.push(`${preSearch.summary}\n\n`);
  } else {
    parts.push(
      `Searched ${preSearch.results.length} ${preSearch.results.length === 1 ? 'query' : 'queries'}: `,
      preSearch.results.map(r => `"${r.query}"`).join(', '),
      '\n\n',
    );
  }

  return parts.join('');
}
