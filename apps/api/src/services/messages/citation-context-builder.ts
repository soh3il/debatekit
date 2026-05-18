/**
 * Citation Context Builder Service
 *
 * Following backend-patterns.md: Service layer for business logic
 *
 * Builds citable context from project sources:
 * - Assigns unique source IDs (mem_abc123, thd_xyz456, etc.)
 * - Formats context in clean XML for AI consumption
 * - Creates source maps for citation resolution
 */

import { z } from '@hono/zod-openapi';
import type { CitationSourceType } from '@debatekit/shared/enums';
import {
  CITATION_PREFIXES,
  CITATION_SOURCE_TYPES,
  CitationSourceContentLimits,
  CitationSourceLabels,
  CitationSourcePrefixes,
  CitationSourceTypes,
} from '@debatekit/shared/enums';

import type {
  AggregatedProjectContext,
  CitableContextParams,
} from '@/common/schemas/project-context';
import { getAggregatedProjectContext } from '@/services/context';
import type { CitableContextResult, CitableSource, CitationSourceMap } from '@/types/citations';

// ============================================================================
// Direct Attachment Citation Types (for attachmentIds from R2)
// ============================================================================

/**
 * Input attachment for building citation context from direct file uploads
 * Matches the upload table structure with extracted text content
 */
export const DirectAttachmentInputSchema = z.object({
  /** Original filename */
  filename: z.string(),
  /** File size in bytes */
  fileSize: z.number(),
  /** Upload ID (primary key from upload table) */
  id: z.string(),
  /** MIME type of the file */
  mimeType: z.string(),
  /** Extracted text content from PDFs/documents (null for images/binary) */
  textContent: z.string().nullable().optional(),
});

export type DirectAttachmentInput = z.infer<typeof DirectAttachmentInputSchema>;

/**
 * Result from building attachment citation context
 */
export const AttachmentCitationContextResultSchema = z.object({
  /** Array of CitableSource objects for each attachment */
  citableSources: z.custom<CitableSource[]>(),
  /** Formatted prompt with file info and citation instructions */
  formattedPrompt: z.string(),
  /** Map of citationId to source for resolution */
  sourceMap: z.custom<CitationSourceMap>(),
  /** Statistics about processed attachments */
  stats: z.object({
    totalAttachments: z.number(),
    withTextContent: z.number(),
  }),
});

export type AttachmentCitationContextResult = z.infer<typeof AttachmentCitationContextResultSchema>;

/**
 * Simplified input for file parts (used by streaming orchestration)
 * When attachments are loaded as binary data without text extraction
 */
export const FilePartInputSchema = z.object({
  /** Original filename */
  filename: z.string().optional(),
  /** MIME type of the file */
  mimeType: z.string(),
});

export type FilePartInput = z.infer<typeof FilePartInputSchema>;

// ============================================================================
// Helpers
// ============================================================================

function generateSourceId(type: CitationSourceType, sourceId: string) {
  return `${CitationSourcePrefixes[type]}_${sourceId.replace(/[^a-z0-9]/gi, '').slice(0, 8)}`;
}

// ============================================================================
// Context Building
// ============================================================================

/**
 * Build citable sources from memories
 * Title fallback: memory.summary -> content preview -> "Project Memory"
 */
function buildMemorySources(
  memories: AggregatedProjectContext['memories'],
  projectId?: string,
): CitableSource[] {
  return memories.memories.map(memory => ({
    content: memory.content,
    id: generateSourceId(CitationSourceTypes.MEMORY, memory.id),
    metadata: {
      importance: memory.importance,
      threadId: memory.sourceThreadId || undefined,
      url: projectId ? `/projects/${projectId}/memories` : undefined,
    },
    sourceId: memory.id,
    // Title fallback: summary -> content preview -> generic label (never raw ID)
    title: memory.summary?.trim() || memory.content.slice(0, 50).trim() || 'Project Memory',
    type: CitationSourceTypes.MEMORY,
  }));
}

/**
 * Build citable sources from thread messages
 * Title fallback: thread.title -> "Previous Conversation" (never show raw ID)
 */
function buildThreadSources(
  chats: AggregatedProjectContext['chats'],
): CitableSource[] {
  const sources: CitableSource[] = [];

  for (const thread of chats.threads) {
    // Create one source per thread with combined message context
    const messageContent = thread.messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    if (messageContent.trim()) {
      // Title fallback: actual title -> generic label (never raw ID)
      const title = thread.title?.trim() || 'Previous Conversation';

      sources.push({
        content: messageContent,
        id: generateSourceId(CitationSourceTypes.THREAD, thread.id),
        metadata: {
          roundNumber: thread.messages[0]?.roundNumber,
          threadId: thread.id,
          threadTitle: title,
          url: `/chat/thread/${thread.id}`,
        },
        sourceId: thread.id,
        title,
        type: CitationSourceTypes.THREAD,
      });
    }
  }

  return sources;
}

/**
 * Build citable sources from pre-search results
 *
 * Creates one CitableSource per search query within a search round.
 * Each result contains a query and answer from web search.
 *
 * Title priority: query text -> userQuery -> thread title -> generic
 * (never show raw IDs or generic "Web Search Result")
 */
function buildSearchSources(
  searches: AggregatedProjectContext['searches'],
): CitableSource[] {
  const sources: CitableSource[] = [];

  for (const search of searches.searches) {
    // Create one CitableSource per individual query result for granular citations
    for (let i = 0; i < search.results.length; i++) {
      const result = search.results[i];
      if (!result) {
        continue;
      }

      // Title priority: query text (shows what was searched) -> user query -> thread title -> generic
      // Format query as title to show what the search was about
      const queryTitle = result.query?.trim()
        ? `"${result.query.slice(0, 60)}${result.query.length > 60 ? '...' : ''}"`
        : null;

      const userQueryTitle = search.userQuery?.trim()
        ? `Search: "${search.userQuery.slice(0, 50)}${search.userQuery.length > 50 ? '...' : ''}"`
        : null;

      let title = queryTitle
        || userQueryTitle
        || search.threadTitle?.trim()
        || null;

      // If no title found, use contextual fallback
      if (!title) {
        title = `Web Research Result #${i + 1}`;
      }

      // Create unique ID from threadId + roundNumber + result index
      const uniqueId = `${search.threadId}_r${search.roundNumber}_${i}`;

      const content = [
        `Query: ${result.query}`,
        result.answer ? `Answer: ${result.answer}` : '',
      ].filter(Boolean).join('\n');

      sources.push({
        content,
        id: generateSourceId(CitationSourceTypes.SEARCH, uniqueId),
        metadata: {
          query: result.query, // Store original query in metadata
          roundNumber: search.roundNumber,
          threadId: search.threadId,
          threadTitle: search.threadTitle,
        },
        sourceId: uniqueId,
        title,
        type: CitationSourceTypes.SEARCH,
      });
    }

    // Also create a summary source if available (covers all queries in the round)
    if (search.summary?.trim()) {
      const summaryId = `${search.threadId}_r${search.roundNumber}_summary`;
      const summaryTitle = search.userQuery?.trim()
        ? `Summary: "${search.userQuery.slice(0, 50)}${search.userQuery.length > 50 ? '...' : ''}"`
        : `Round ${(search.roundNumber ?? 0) + 1} Search Summary`;

      sources.push({
        content: search.summary,
        id: generateSourceId(CitationSourceTypes.SEARCH, summaryId),
        metadata: {
          description: 'Search summary', // Use description to indicate this is a summary
          roundNumber: search.roundNumber,
          threadId: search.threadId,
          threadTitle: search.threadTitle,
        },
        sourceId: summaryId,
        title: summaryTitle,
        type: CitationSourceTypes.SEARCH,
      });
    }
  }

  return sources;
}

/**
 * Build citable sources from moderators
 * Title fallback: "Round N Summary" (never show raw ID)
 */
function buildModeratorSources(
  moderators: AggregatedProjectContext['moderators'],
): CitableSource[] {
  return moderators.moderators.map((moderator) => {
    const content = [
      `Question: ${moderator.userQuestion}`,
      `Moderator: ${moderator.moderator}`,
      moderator.recommendations.length > 0
        ? `Recommendations: ${moderator.recommendations.join(', ')}`
        : '',
      moderator.keyThemes ? `Key Themes: ${moderator.keyThemes}` : '',
    ].filter(Boolean).join('\n');

    // Create unique ID from threadId + roundNumber
    const uniqueId = `${moderator.threadId}_r${moderator.roundNumber}`;

    // Title fallback: question-based -> round-based -> generic (never raw ID)
    const title = moderator.userQuestion?.trim()
      ? `Moderator: ${moderator.userQuestion.slice(0, 50)}${moderator.userQuestion.length > 50 ? '...' : ''}`
      : `Round ${(moderator.roundNumber ?? 0) + 1} Summary`;

    return {
      content,
      id: generateSourceId(CitationSourceTypes.MODERATOR, uniqueId),
      metadata: {
        roundNumber: moderator.roundNumber,
        threadId: moderator.threadId,
        threadTitle: moderator.threadTitle,
      },
      sourceId: uniqueId,
      title,
      type: CitationSourceTypes.MODERATOR,
    };
  });
}

/**
 * Build citable sources from project attachments
 * When textContent is available, includes actual file content for AI to reference
 * Title fallback: filename -> "Attached File" (never show raw ID)
 */
function buildAttachmentSources(
  attachments: AggregatedProjectContext['attachments'],
  baseUrl: string,
): CitableSource[] {
  return attachments.attachments.map((attachment) => {
    // Format file size for display
    const sizeKB = (attachment.fileSize / 1024).toFixed(1);
    const sizeMB = (attachment.fileSize / (1024 * 1024)).toFixed(1);
    const sizeDisplay = attachment.fileSize > 1024 * 1024 ? `${sizeMB}MB` : `${sizeKB}KB`;

    // Determine file type description
    const typeDescription = attachment.mimeType.startsWith('image/')
      ? 'Image file'
      : attachment.mimeType.startsWith('text/')
        ? 'Text file'
        : attachment.mimeType === 'application/pdf'
          ? 'PDF document'
          : attachment.mimeType.includes('json')
            ? 'JSON file'
            : 'File';

    // Source label: project-level files vs thread uploads
    const sourceLabel = attachment.source === 'project'
      ? 'Project file'
      : attachment.threadTitle
        ? `From thread: ${attachment.threadTitle}`
        : '';

    // Build content: use textContent if available, else metadata only
    let content: string;
    if (attachment.textContent) {
      // Include actual file content for AI to reference and cite
      const header = [
        `Filename: ${attachment.filename}`,
        `Type: ${typeDescription} (${attachment.mimeType})`,
        `Size: ${sizeDisplay}`,
        sourceLabel,
      ].filter(Boolean).join('\n');
      content = `${header}\n\n--- Document Content ---\n${attachment.textContent}`;
    } else {
      // Metadata only for files without extractable text (images, etc.)
      content = [
        `Filename: ${attachment.filename}`,
        `Type: ${typeDescription} (${attachment.mimeType})`,
        `Size: ${sizeDisplay}`,
        sourceLabel,
        '(No text content available - binary file)',
      ].filter(Boolean).join('\n');
    }

    // Generate absolute download URL for attachment
    const downloadUrl = `${baseUrl}/api/v1/uploads/${attachment.id}/download`;

    // Title fallback: filename -> generic label (never raw ID)
    const title = attachment.filename?.trim() || 'Attached File';

    return {
      content,
      id: generateSourceId(CitationSourceTypes.ATTACHMENT, attachment.id),
      metadata: {
        // Include attachment-specific fields for citation UI
        downloadUrl,
        filename: attachment.filename,
        fileSize: attachment.fileSize,
        hasTextContent: !!attachment.textContent,
        mimeType: attachment.mimeType,
        source: attachment.source,
        threadId: attachment.threadId || undefined,
        threadTitle: attachment.threadTitle || undefined,
      },
      sourceId: attachment.id,
      title,
      type: CitationSourceTypes.ATTACHMENT,
    };
  });
}

function formatSourcesList(sources: CitableSource[]) {
  if (sources.length === 0) {
    return '';
  }

  const lines = sources.map(source =>
    `<source id="${source.id}" type="${CitationSourceLabels[source.type]}" title="${source.title}" />`,
  );

  return `<available-context>\n${lines.join('\n')}\n</available-context>`;
}

function formatContextWithSources(sources: CitableSource[]) {
  if (sources.length === 0) {
    return '';
  }

  const sections: string[] = [];
  const byType = sources.reduce<Partial<Record<CitationSourceType, CitableSource[]>>>((acc, source) => {
    const existing = acc[source.type];
    if (existing) {
      existing.push(source);
    } else {
      acc[source.type] = [source];
    }
    return acc;
  }, {});

  for (const sourceType of CITATION_SOURCE_TYPES) {
    const typeSources = byType[sourceType];
    if (!typeSources?.length) {
      continue;
    }

    const contentLimit = CitationSourceContentLimits[sourceType];
    const content = typeSources.map((s, index) => {
      const truncated = s.content.length > contentLimit;
      return `<item id="${s.id}" index="${index + 1}" title="${s.title}">
${s.content.slice(0, contentLimit)}${truncated ? '...' : ''}
</item>`;
    }).join('\n\n');

    sections.push(`<${sourceType}-context>\n${content}\n</${sourceType}-context>`);
  }

  return sections.join('\n\n');
}

// ============================================================================
// Direct Attachment Citation Context Builder
// ============================================================================

/**
 * Build citation context from direct file uploads (attachmentIds from R2)
 *
 * This function handles direct file uploads that are NOT part of the project context.
 * It generates citation IDs in the format: att_${uploadId.slice(0, 8)}
 *
 * @param attachments - Array of attachment objects from upload table with optional textContent
 * @returns AttachmentCitationContextResult with formattedPrompt, citableSources, and sourceMap
 *
 * @example
 * ```typescript
 * const result = buildAttachmentCitationContext([
 *   { id: 'upload123abc', filename: 'report.pdf', mimeType: 'application/pdf', fileSize: 1024, textContent: '...' },
 * ]);
 * // result.citableSources[0].id === 'att_upload12'
 * ```
 */
export function buildAttachmentCitationContext(
  attachments: DirectAttachmentInput[],
): AttachmentCitationContextResult {
  if (!attachments || attachments.length === 0) {
    return {
      citableSources: [],
      formattedPrompt: '',
      sourceMap: new Map(),
      stats: { totalAttachments: 0, withTextContent: 0 },
    };
  }

  const citableSources: CitableSource[] = [];
  const sourceMap: CitationSourceMap = new Map();
  let withTextContent = 0;

  for (const attachment of attachments) {
    // Generate citation ID: att_${uploadId.slice(0, 8)}
    const citationId = generateSourceId(CitationSourceTypes.ATTACHMENT, attachment.id);

    // Format file size for display
    const sizeKB = (attachment.fileSize / 1024).toFixed(1);
    const sizeMB = (attachment.fileSize / (1024 * 1024)).toFixed(1);
    const sizeDisplay = attachment.fileSize > 1024 * 1024 ? `${sizeMB}MB` : `${sizeKB}KB`;

    // Determine file type description
    const typeDescription = attachment.mimeType.startsWith('image/')
      ? 'Image file'
      : attachment.mimeType.startsWith('text/')
        ? 'Text file'
        : attachment.mimeType === 'application/pdf'
          ? 'PDF document'
          : attachment.mimeType.includes('json')
            ? 'JSON file'
            : 'File';

    // Build content: use textContent if available, else metadata only
    let content: string;
    if (attachment.textContent) {
      withTextContent++;
      const header = [
        `Filename: ${attachment.filename}`,
        `Type: ${typeDescription} (${attachment.mimeType})`,
        `Size: ${sizeDisplay}`,
      ].join('\n');
      content = `${header}\n\n--- Document Content ---\n${attachment.textContent}`;
    } else {
      content = [
        `Filename: ${attachment.filename}`,
        `Type: ${typeDescription} (${attachment.mimeType})`,
        `Size: ${sizeDisplay}`,
        '(No text content available - binary file)',
      ].join('\n');
    }

    const source: CitableSource = {
      content,
      id: citationId,
      metadata: {
        filename: attachment.filename,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
      },
      sourceId: attachment.id,
      title: attachment.filename,
      type: CitationSourceTypes.ATTACHMENT,
    };

    citableSources.push(source);
    sourceMap.set(citationId, source);
  }

  // Build formatted prompt with citation instructions
  const formattedPrompt = buildAttachmentCitationPrompt(citableSources);

  return {
    citableSources,
    formattedPrompt,
    sourceMap,
    stats: {
      totalAttachments: attachments.length,
      withTextContent,
    },
  };
}

/**
 * Build formatted prompt section for attachment citations
 * Follows the pattern from search-context-builder.ts
 */
function buildAttachmentCitationPrompt(sources: CitableSource[]): string {
  if (sources.length === 0) {
    return '';
  }

  // Build file context section
  const fileContextParts: string[] = [
    '\n\n## Attached Files\n\n',
    'The following files were uploaded with this message. Reference their content using the provided citation IDs:\n\n',
  ];

  for (const source of sources) {
    const contentLimit = CitationSourceContentLimits[CitationSourceTypes.ATTACHMENT];
    const truncated = source.content.length > contentLimit;

    fileContextParts.push(`### [${source.id}] ${source.title}\n`);
    fileContextParts.push('```\n');
    fileContextParts.push(source.content.slice(0, contentLimit));
    if (truncated) {
      fileContextParts.push('...');
    }
    fileContextParts.push('\n```\n\n');
  }

  // Concise citation instructions
  const sourceList = sources
    .slice(0, 10)
    .map((s, i) => `  ${i + 1}. "${s.title}" → [${s.id}]`)
    .join('\n');

  fileContextParts.push(
    '## Citation Requirements\n\n',
    'Cite files inline using their [att_xxxxxxxx] IDs when referencing their content.\n',
    'Place the citation immediately after the fact it supports.\n\n',
    'Available files:\n',
    sourceList,
    '\n\n',
    `Example: "The report shows revenue grew 15% [${sources[0]?.id || 'att_example'}]."\n\n`,
  );

  return fileContextParts.join('');
}

/**
 * Build citation context from file parts (simpler format for streaming orchestration)
 *
 * This is a convenience function for when you only have file parts (loaded binary data)
 * and attachment IDs, without the full upload metadata or extracted text content.
 *
 * Use `buildAttachmentCitationContext` when you have the full DirectAttachmentInput
 * with textContent for richer citation context.
 *
 * @param fileParts - Array of file parts with filename and mimeType
 * @param attachmentIds - Array of upload IDs matching the file parts
 * @returns Object with formattedPrompt and citableSources
 *
 * @example
 * ```typescript
 * const result = buildFilePartCitationContext(
 *   [{ filename: 'report.pdf', mimeType: 'application/pdf' }],
 *   ['upload123abc']
 * );
 * // result.citableSources[0].id === 'att_upload12'
 * ```
 */
export function buildFilePartCitationContext(
  fileParts: FilePartInput[],
  attachmentIds: string[],
): { formattedPrompt: string; citableSources: CitableSource[] } {
  const citableSources: CitableSource[] = [];

  if (fileParts.length === 0) {
    return { citableSources, formattedPrompt: '' };
  }

  // Build citable sources for each attachment
  for (let i = 0; i < fileParts.length; i++) {
    const part = fileParts[i];
    const uploadId = attachmentIds[i];
    if (!part || !uploadId) {
      continue;
    }

    const citationId = generateSourceId(CitationSourceTypes.ATTACHMENT, uploadId);
    const filename = part.filename || 'Unnamed file';

    citableSources.push({
      content: `File: ${filename} (${part.mimeType})`,
      id: citationId,
      metadata: {
        filename,
        mimeType: part.mimeType,
      },
      sourceId: uploadId,
      title: filename,
      type: CitationSourceTypes.ATTACHMENT,
    });
  }

  // Build the formatted prompt with citation instructions
  // Note: The actual file content is passed directly to you as binary data (images/PDFs).
  // You can analyze and understand the file content natively.
  const parts: string[] = [
    '\n\n## Attached Files\n\n',
    'The following files are provided directly for analysis. Cite them when referencing their content.\n\n',
  ];

  // List each file with its citation ID
  const sourceList = citableSources
    .slice(0, 10)
    .map((s, i) => `  ${i + 1}. "${s.title}" (${s.metadata?.mimeType}) → [${s.id}]`)
    .join('\n');

  parts.push(
    'Available files:\n',
    sourceList,
    '\n\n',
    'Cite inline using [att_xxxxxxxx] IDs after the fact each supports.\n',
    `Example: "The document shows quarterly growth of 15% [${citableSources[0]?.id || 'att_example'}]."\n\n`,
  );

  return { citableSources, formattedPrompt: parts.join('') };
}

// ============================================================================
// Main Functions
// ============================================================================

export async function buildCitableContext(params: CitableContextParams): Promise<CitableContextResult> {
  const aggregatedContext = await getAggregatedProjectContext(params);

  const memorySources = buildMemorySources(aggregatedContext.memories, params.projectId);
  const threadSources = buildThreadSources(aggregatedContext.chats);
  const searchSources = buildSearchSources(aggregatedContext.searches);
  const moderatorSources = buildModeratorSources(aggregatedContext.moderators);
  const attachmentSources = buildAttachmentSources(aggregatedContext.attachments, params.baseUrl);

  const allSources = [
    ...memorySources,
    ...threadSources,
    ...searchSources,
    ...moderatorSources,
    ...attachmentSources,
  ];

  const sourceMap: CitationSourceMap = new Map(allSources.map(source => [source.id, source]));

  const formattedPrompt = allSources.length > 0
    ? [
        '\n\n<project-context>',
        formatSourcesList(allSources),
        formatContextWithSources(allSources),
        '</project-context>',
        '',
        '## Citation Requirements',
        '',
        'Cite project context inline using the source IDs above.',
        'Place the citation immediately after the fact it supports.',
        '',
        'Available sources:',
        ...allSources.slice(0, 15).map((s, i) => `  ${i + 1}. "${s.title}" → [${s.id}]`),
        '',
        `Example: "You prefer dark mode [${memorySources[0]?.id || 'mem_example'}]."`,
      ].join('\n')
    : '';

  return {
    formattedPrompt,
    sourceMap,
    sources: allSources,
    stats: {
      totalAttachments: attachmentSources.length,
      totalMemories: aggregatedContext.memories.totalCount,
      totalModerators: aggregatedContext.moderators.totalCount,
      totalSearches: aggregatedContext.searches.totalCount,
      totalThreads: aggregatedContext.chats.totalThreads,
    },
  };
}

export function resolveSourceId(sourceId: string, sourceMap: CitationSourceMap): CitableSource | undefined {
  return sourceMap.get(sourceId);
}

export function extractCitationMarkers(text: string): string[] {
  // Use CITATION_PREFIXES from enum for single source of truth
  const citationPattern = new RegExp(
    `\\[(${CITATION_PREFIXES.join('|')})_[a-zA-Z0-9]+\\]`,
    'g',
  );
  const matches = text.match(citationPattern) || [];
  return [...new Set(matches.map(m => m.slice(1, -1)))];
}

export function resolveCitations(text: string, sourceMap: CitationSourceMap): {
  sourceId: string;
  displayNumber: number;
  source: CitableSource | undefined;
}[] {
  const markers = extractCitationMarkers(text);
  return markers.map((sourceId, index) => ({
    displayNumber: index + 1,
    source: sourceMap.get(sourceId),
    sourceId,
  }));
}
