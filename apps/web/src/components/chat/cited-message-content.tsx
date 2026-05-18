/**
 * CitedMessageContent Component
 *
 * Renders AI response text with citations stripped from inline text and shown
 * in a unified Sources tooltip at the end of the response. Uses carousel
 * navigation for browsing multiple sources.
 *
 * @module components/chat/cited-message-content
 */

import { CitationSegmentTypes } from '@debatekit/shared';
import { useMemo } from 'react';
import Markdown from 'react-markdown';

import { LazyStreamdown } from '@/components/markdown/lazy-streamdown';
import { remarkPlugins, streamdownComponents } from '@/components/markdown/unified-markdown-components';
import { cn } from '@/lib/ui/cn';
import { parseCitations } from '@/lib/utils';
import type { AvailableSource, DbCitation } from '@/services/api';

import { formatCitationIdForDisplay } from '../ai-elements/citation-utils';
import type { SourceData } from '../ai-elements/inline-citation';
import { SourcesFooter } from '../ai-elements/inline-citation';

// ============================================================================
// Types
// ============================================================================

export type CitedMessageContentProps = {
  /** The text content to render with citations */
  text: string;
  /** Optional resolved citation data from message metadata */
  citations?: DbCitation[];
  /** Optional available sources for fallback during streaming (before citations are resolved) */
  availableSources?: AvailableSource[];
  /** Whether the message is currently streaming */
  isStreaming?: boolean;
  /** Additional class name for the wrapper */
  className?: string;
  /** Skip transitions and use SSR-friendly rendering (ReactMarkdown instead of Streamdown) */
  skipTransitions?: boolean;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders message content with citations shown in a unified footer
 *
 * Citations markers are stripped from text and all sources are displayed
 * in a single Sources tooltip at the end of the response with carousel navigation.
 */
export function CitedMessageContent({
  availableSources,
  citations,
  className,
  isStreaming: _isStreaming = false,
  skipTransitions = false,
  text,
}: CitedMessageContentProps) {
  const parsedResult = useMemo(
    () => parseCitations(text),
    [text],
  );

  // Build citation map from resolved citations
  const citationMap = useMemo(() => {
    if (!citations) {
      return new Map<string, DbCitation>();
    }
    return new Map(citations.map(c => [c.id, c]));
  }, [citations]);

  // Build fallback map from availableSources (for during streaming before citations are resolved)
  const availableSourceMap = useMemo(() => {
    if (!availableSources) {
      return new Map<string, AvailableSource>();
    }
    return new Map(availableSources.map(s => [s.id, s]));
  }, [availableSources]);

  // Strip citation markers and collect source data
  const { plainText, sourceData } = useMemo(() => {
    // Join all text segments, ignoring citation markers
    const textParts: string[] = [];
    const sources: SourceData[] = [];
    const seenIds = new Set<string>();

    for (const segment of parsedResult.segments) {
      if (segment.type === CitationSegmentTypes.TEXT) {
        textParts.push(segment.content);
      } else if (segment.type === CitationSegmentTypes.CITATION) {
        const { citation } = segment;

        // Skip duplicates
        if (seenIds.has(citation.sourceId)) {
          continue;
        }
        seenIds.add(citation.sourceId);

        const resolvedCitation = citationMap.get(citation.sourceId);
        const fallbackSource = availableSourceMap.get(citation.sourceId);

        // ✅ FIX: Skip hallucinated citations that don't match any known source
        // AI models sometimes cite placeholder patterns like "sch_qXrY" literally
        // or generate invalid citation IDs. Don't show these in the sources footer.
        if (!resolvedCitation && !fallbackSource) {
          continue;
        }

        sources.push({
          // Search-specific fields
          author: resolvedCitation?.author || fallbackSource?.author,
          description: resolvedCitation?.description || fallbackSource?.description,
          domain: resolvedCitation?.domain || fallbackSource?.domain,
          downloadUrl: resolvedCitation?.downloadUrl || fallbackSource?.downloadUrl,
          // Use excerpt from resolved citation OR fallback source for quote display
          excerpt: resolvedCitation?.excerpt || fallbackSource?.excerpt,
          filename: resolvedCitation?.filename || fallbackSource?.filename,
          fileSize: resolvedCitation?.fileSize || fallbackSource?.fileSize,
          id: citation.sourceId,
          mimeType: resolvedCitation?.mimeType || fallbackSource?.mimeType,
          publishedDate: resolvedCitation?.publishedDate || fallbackSource?.publishedDate,
          query: resolvedCitation?.query || fallbackSource?.query,
          roundNumber: resolvedCitation?.roundNumber ?? fallbackSource?.roundNumber,
          sourceType: citation.sourceType,
          threadTitle: resolvedCitation?.threadTitle || fallbackSource?.threadTitle,
          // Title fallback: uses formatCitationIdForDisplay with full fallback chain
          // Priority: title > filename > domain > pattern-parsed ID > generic label
          title: formatCitationIdForDisplay(citation.sourceId, citation.sourceType, {
            domain: resolvedCitation?.domain || fallbackSource?.domain || undefined,
            filename: resolvedCitation?.filename || fallbackSource?.filename || undefined,
            title: resolvedCitation?.title || fallbackSource?.title || undefined,
          }),
          url: resolvedCitation?.url || fallbackSource?.url,
        });
      }
    }

    return {
      plainText: textParts.join(''),
      sourceData: sources,
    };
  }, [parsedResult, citationMap, availableSourceMap]);

  // ✅ FIX: Show availableSources even when AI didn't include inline citations
  // This happens when pre-search ran but AI wasn't instructed to cite sources
  const fallbackSources = useMemo((): SourceData[] => {
    if (sourceData.length > 0 || !availableSources || availableSources.length === 0) {
      return [];
    }
    return availableSources.map(s => ({
      author: s.author,
      description: s.description,
      domain: s.domain,
      downloadUrl: s.downloadUrl,
      excerpt: s.excerpt,
      filename: s.filename,
      fileSize: s.fileSize,
      id: s.id,
      mimeType: s.mimeType,
      publishedDate: s.publishedDate,
      query: s.query,
      roundNumber: s.roundNumber,
      sourceType: s.sourceType,
      threadTitle: s.threadTitle,
      title: s.title,
      url: s.url,
    }));
  }, [sourceData.length, availableSources]);

  // Final sources: use parsed citations if available, otherwise fallback to availableSources
  const finalSources = sourceData.length > 0 ? sourceData : fallbackSources;

  // Helper to render markdown with SSR support
  const renderMarkdown = (content: string) => {
    if (skipTransitions) {
      // SSR: Direct import renders synchronously - no hydration flash
      return <Markdown remarkPlugins={remarkPlugins} components={streamdownComponents}>{content}</Markdown>;
    }
    // Client: Use streaming-capable lazy markdown
    return <LazyStreamdown components={streamdownComponents}>{content}</LazyStreamdown>;
  };

  // No citations and no available sources - render plain markdown
  if (finalSources.length === 0) {
    return (
      <div dir="auto" className={cn('prose prose-sm dark:prose-invert max-w-none min-w-0', className)}>
        {renderMarkdown(plainText)}
      </div>
    );
  }

  // Render text with unified Sources footer
  // Always use plainText — citation markers are stripped regardless of resolution status
  const displayText = plainText;
  return (
    <div dir="auto" className={cn('prose prose-sm dark:prose-invert max-w-none min-w-0', className)}>
      {renderMarkdown(displayText)}
      <SourcesFooter sources={finalSources} />
    </div>
  );
}
