import type { AvailableSource, CitationSourceType } from '@debatekit/shared';
import { CitationSourceTypes } from '@debatekit/shared';
import { usePostHog } from 'posthog-js/react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { createContext, memo, use, useCallback, useMemo, useState } from 'react';

import type { Icon } from '@/components/icons';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
} from '@/components/ui/carousel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CHAT_UI_EVENTS } from '@/constants/analytics';
import { formatFileSize } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui/cn';

import { extractHostname, formatCitationIdForDisplay } from './citation-utils';

// ============================================================================
// Context for Citation State
// ============================================================================

type InlineCitationContextValue = {
  readonly isOpen: boolean;
  readonly setIsOpen: (open: boolean) => void;
};

const InlineCitationContext = createContext<InlineCitationContextValue | null>(null);

function useInlineCitation() {
  const context = use(InlineCitationContext);
  if (!context) {
    throw new Error('InlineCitation components must be used within InlineCitation');
  }
  return context;
}

// ============================================================================
// Source Type Icons & Labels
// ============================================================================

type SourceTypeConfig = {
  readonly icon: Icon;
  readonly label: string;
  readonly color: string;
};

const SOURCE_TYPE_CONFIG: Record<CitationSourceType, SourceTypeConfig> = {
  [CitationSourceTypes.ATTACHMENT]: {
    color: 'text-green-500',
    icon: Icons.fileText,
    label: 'File',
  },
  [CitationSourceTypes.DOMAIN]: {
    color: 'text-blue-500',
    icon: Icons.database,
    label: 'Domain Data',
  },
  [CitationSourceTypes.MEMORY]: {
    color: 'text-purple-500',
    icon: Icons.sparkles,
    label: 'Memory',
  },
  [CitationSourceTypes.MODERATOR]: {
    color: 'text-cyan-500',
    icon: Icons.search,
    label: 'Moderator',
  },
  [CitationSourceTypes.RAG]: {
    color: 'text-indigo-500',
    icon: Icons.database,
    label: 'Indexed File',
  },
  [CitationSourceTypes.SEARCH]: {
    color: 'text-amber-500',
    icon: Icons.globe,
    label: 'Search',
  },
  [CitationSourceTypes.THREAD]: {
    color: 'text-blue-500',
    icon: Icons.messageSquare,
    label: 'Thread',
  },
};

// ============================================================================
// InlineCitation Root
// ============================================================================

type InlineCitationProps = {
  readonly className?: string;
  readonly children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<'span'>, 'className' | 'children'>;

function InlineCitation({ children, className, ...props }: InlineCitationProps) {
  const [isOpen, setIsOpen] = useState(false);

  const contextValue = useMemo(
    () => ({ isOpen, setIsOpen }),
    [isOpen],
  );

  return (
    <InlineCitationContext value={contextValue}>
      <span data-slot="inline-citation" className={cn('inline', className)} {...props}>
        {children}
      </span>
    </InlineCitationContext>
  );
}

// ============================================================================
// InlineCitationCard (Popover Container)
// ============================================================================

type InlineCitationCardProps = {
  readonly children: ReactNode;
};

function InlineCitationCard({ children }: InlineCitationCardProps) {
  const { isOpen, setIsOpen } = useInlineCitation();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      {children}
    </Popover>
  );
}

// ============================================================================
// InlineCitationCardTrigger (Badge Button)
// ============================================================================

type InlineCitationCardTriggerProps = {
  /** Display number for fallback when no sources */
  readonly displayNumber?: number;
  readonly sourceType: CitationSourceType;
  /** Array of source URLs to display hostname badge */
  readonly sources?: string[];
  readonly className?: string;
};

function InlineCitationCardTrigger({
  className,
  displayNumber,
  sources = [],
  sourceType,
}: InlineCitationCardTriggerProps) {
  const config = SOURCE_TYPE_CONFIG[sourceType];

  if (!config) {
    return null;
  }

  // Get display text: hostname for search results, type label for others
  const getDisplayText = () => {
    // For search results with URLs, show hostname
    if (sourceType === CitationSourceTypes.SEARCH && sources.length > 0) {
      const hostname = extractHostname(sources[0] ?? '');
      if (hostname) {
        const extraCount = sources.length - 1;
        return extraCount > 0 ? `${hostname} +${extraCount}` : hostname;
      }
    }

    // For other source types, show short label
    const shortLabels: Record<CitationSourceType, string> = {
      [CitationSourceTypes.ATTACHMENT]: 'file',
      [CitationSourceTypes.DOMAIN]: 'data',
      [CitationSourceTypes.MEMORY]: 'mem',
      [CitationSourceTypes.MODERATOR]: 'mod',
      [CitationSourceTypes.RAG]: 'doc',
      [CitationSourceTypes.SEARCH]: 'web',
      [CitationSourceTypes.THREAD]: 'chat',
    };

    return shortLabels[sourceType] || (displayNumber?.toString() ?? '?');
  };

  const IconComponent = config.icon;

  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-center align-baseline',
          'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          className,
        )}
      >
        <Badge
          variant="glass"
          className={cn(
            'h-5 px-1.5 text-[11px] font-medium leading-none gap-1',
            config.color,
          )}
        >
          <IconComponent className="size-3" />
          <span>{getDisplayText()}</span>
        </Badge>
      </button>
    </PopoverTrigger>
  );
}

// ============================================================================
// InlineCitationCardBody (Popover Content)
// ============================================================================

type InlineCitationCardBodyProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

function InlineCitationCardBody({ children, className }: InlineCitationCardBodyProps) {
  return (
    <PopoverContent className={cn('z-20 w-80 p-0 backdrop-blur-lg bg-popover/95', className)} align="start" side="bottom" sideOffset={8}>
      <div className="p-3 space-y-3">{children}</div>
    </PopoverContent>
  );
}

// ============================================================================
// InlineCitationSource (Source Info Display)
// ============================================================================

type InlineCitationSourceProps = {
  readonly title: string;
  readonly sourceType: CitationSourceType;
  readonly description?: string;
  readonly url?: string;
  readonly threadTitle?: string;
  readonly className?: string;
  readonly downloadUrl?: string;
  readonly filename?: string;
  readonly mimeType?: string;
  readonly fileSize?: number;
  /** Whether the citation data has been fully resolved from the database */
  readonly isResolved?: boolean;
  /** Raw citation ID for fallback display */
  readonly citationId?: string;
  /** Domain for search results */
  readonly domain?: string;
  /** Search query that returned this result */
  readonly query?: string;
  /** Published date for search results */
  readonly publishedDate?: string;
  /** Author of the source content */
  readonly author?: string;
  /** Round number where source was used */
  readonly roundNumber?: number;
  /** Content excerpt that was cited */
  readonly excerpt?: string;
};

function InlineCitationSource({
  author,
  citationId,
  className,
  description,
  domain,
  downloadUrl,
  excerpt,
  filename,
  fileSize,
  isResolved: _isResolved = true,
  mimeType,
  publishedDate,
  query,
  roundNumber,
  sourceType,
  threadTitle,
  title,
  url,
}: InlineCitationSourceProps) {
  const t = useTranslations();
  const config = SOURCE_TYPE_CONFIG[sourceType];

  if (!config) {
    return null;
  }

  const IconComponent = config.icon;
  const isAttachment = sourceType === CitationSourceTypes.ATTACHMENT;
  const isSearch = sourceType === CitationSourceTypes.SEARCH;
  const isThread = sourceType === CitationSourceTypes.THREAD;
  const isMemory = sourceType === CitationSourceTypes.MEMORY;

  // Extract hostname from URL for display (useful for search citations)
  const urlHostname = url
    ? (() => {
        try {
          return new URL(url).hostname;
        } catch {
          return null;
        }
      })()
    : null;

  // Use domain prop if available, otherwise extract from URL
  const displayDomain = domain || urlHostname;

  // Format title nicely - uses formatCitationIdForDisplay with full fallback chain
  // Priority: title > filename > domain > pattern-parsed ID > generic label
  // Check for empty strings (not just falsy) since backend may send ''
  const displayTitle = formatCitationIdForDisplay(citationId || '', sourceType, {
    domain: displayDomain || undefined,
    filename: filename && filename.trim() ? filename : undefined,
    title: title && title.trim() ? title : undefined,
  });

  // Build metadata items for search results
  const searchMetaItems: string[] = [];
  if (isSearch) {
    if (author) {
      searchMetaItems.push(author);
    }
    if (publishedDate) {
      searchMetaItems.push(publishedDate);
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start gap-2">
        <div className={cn('shrink-0 p-1.5 rounded-md bg-muted/50', config.color)}>
          <IconComponent className="size-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {config.label}
            </Badge>
            {/* Show domain for search results */}
            {isSearch && displayDomain && (
              <span className="text-[10px] text-muted-foreground truncate">
                {displayDomain}
              </span>
            )}
            {/* Show thread title for thread citations */}
            {isThread && threadTitle && (
              <span className="text-[10px] text-muted-foreground truncate">
                {threadTitle}
              </span>
            )}
            {/* Show round number for threads/memories */}
            {(isThread || isMemory) && roundNumber !== undefined && (
              <span className="text-[10px] text-muted-foreground">
                Round
                {' '}
                {roundNumber + 1}
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium leading-tight mt-0.5 line-clamp-2">{displayTitle}</h4>
          {/* Search result metadata: author, published date */}
          {isSearch && searchMetaItems.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {searchMetaItems.join(' · ')}
            </p>
          )}
          {/* Show search query that returned this result */}
          {isSearch && query && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">
              Query: "
              {query}
              "
            </p>
          )}
          {/* Attachment metadata */}
          {isAttachment && (mimeType || fileSize) && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {mimeType && <span>{mimeType}</span>}
              {mimeType && fileSize && <span> · </span>}
              {fileSize && <span>{formatFileSize(fileSize)}</span>}
            </p>
          )}
        </div>
      </div>
      {/* Show excerpt - the actual content that was cited */}
      {excerpt && (
        <blockquote className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2 italic line-clamp-4">
          "
          {excerpt}
          "
        </blockquote>
      )}
      {/* Show description if no excerpt available */}
      {!excerpt && description && (
        <p className="text-xs text-muted-foreground line-clamp-3">{description}</p>
      )}
      {isAttachment && downloadUrl && (
        <a
          href={downloadUrl}
          download={filename || title}
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
            'bg-primary/10 text-primary hover:bg-primary/20',
            'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          )}
        >
          <Icons.download className="size-3" />
          <span>{t('chat.citations.download', { name: filename || 'file' })}</span>
        </a>
      )}
      {url && !isAttachment && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center gap-1 text-xs text-primary',
            'hover:underline focus:outline-none focus-visible:underline',
          )}
        >
          <Icons.externalLink className="size-3" />
          <span className="truncate max-w-[200px]">{displayDomain || url}</span>
        </a>
      )}
    </div>
  );
}

// ============================================================================
// InlineCitationQuote (Quoted Excerpt)
// ============================================================================

type InlineCitationQuoteProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

function InlineCitationQuote({ children, className }: InlineCitationQuoteProps) {
  return (
    <p className={cn('text-xs text-muted-foreground line-clamp-3', className)}>
      {children}
    </p>
  );
}

// ============================================================================
// InlineCitationText (Inline Text with Citation)
// ============================================================================

type InlineCitationTextProps = {
  readonly className?: string;
} & Omit<ComponentPropsWithoutRef<'span'>, 'className'>;

function InlineCitationText({ className, ...props }: InlineCitationTextProps) {
  return <span data-slot="inline-citation-text" className={cn('inline', className)} {...props} />;
}

// ============================================================================
// Carousel Components for Citation Sources
// ============================================================================

type InlineCitationCarouselProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

function InlineCitationCarousel({ children, className }: InlineCitationCarouselProps) {
  return (
    <Carousel
      opts={{ align: 'start', loop: false }}
      className={cn('w-full', className)}
    >
      {children}
    </Carousel>
  );
}

type InlineCitationCarouselHeaderProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

function InlineCitationCarouselHeader({ children, className }: InlineCitationCarouselHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-2 mb-2', className)}>
      {children}
    </div>
  );
}

type InlineCitationCarouselIndexProps = {
  readonly className?: string;
  readonly children?: ReactNode;
};

function InlineCitationCarouselIndex({ children, className }: InlineCitationCarouselIndexProps) {
  const { api } = useCarousel();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) {
      return;
    }
    setCurrent(api.selectedScrollSnap() + 1);
    setCount(api.scrollSnapList().length);
  }, [api]);

  // Subscribe to carousel changes
  useMemo(() => {
    if (!api) {
      return;
    }
    onSelect();
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api, onSelect]);

  if (children) {
    return <div className={cn('text-xs text-muted-foreground', className)}>{children}</div>;
  }

  return (
    <div className={cn('text-xs text-muted-foreground tabular-nums', className)}>
      {current}
      /
      {count}
    </div>
  );
}

type InlineCitationCarouselPrevProps = {
  readonly className?: string;
};

function InlineCitationCarouselPrev({ className }: InlineCitationCarouselPrevProps) {
  return (
    <CarouselPrevious
      variant="ghost"
      size="sm"
      className={cn(
        'relative static translate-x-0 translate-y-0 h-6 w-6',
        className,
      )}
    />
  );
}

type InlineCitationCarouselNextProps = {
  readonly className?: string;
};

function InlineCitationCarouselNext({ className }: InlineCitationCarouselNextProps) {
  return (
    <CarouselNext
      variant="ghost"
      size="sm"
      className={cn(
        'relative static translate-x-0 translate-y-0 h-6 w-6',
        className,
      )}
    />
  );
}

type InlineCitationCarouselContentProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

function InlineCitationCarouselContent({ children, className }: InlineCitationCarouselContentProps) {
  return (
    <CarouselContent className={cn('-ml-2', className)}>
      {children}
    </CarouselContent>
  );
}

type InlineCitationCarouselItemProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

function InlineCitationCarouselItem({ children, className }: InlineCitationCarouselItemProps) {
  return (
    <CarouselItem className={cn('pl-2 basis-full', className)}>
      <div className="space-y-2">
        {children}
      </div>
    </CarouselItem>
  );
}

// ============================================================================
// SourcesFooter - Unified Sources Display at End of Response
// ============================================================================

/**
 * SourceData - Type alias for AvailableSource from Zod schema
 *
 * ✅ SINGLE SOURCE OF TRUTH: Uses AvailableSourceSchema from @/api/types/citations
 * This ensures the citation data structure is consistent across the codebase.
 */
type SourceData = AvailableSource;

type SourcesFooterProps = {
  readonly sources: SourceData[];
  readonly className?: string;
};

/**
 * SourcesFooter - Memoized to prevent re-renders during streaming
 *
 * Uses React.memo with custom comparison to only re-render when:
 * - sources array length changes
 * - source IDs change
 * - className changes
 */
const SourcesFooter = memo(({ className, sources }: SourcesFooterProps) => {
  const t = useTranslations();
  const posthog = usePostHog();
  const [isOpen, setIsOpen] = useState(false);

  const contextValue = useMemo(
    () => ({ isOpen, setIsOpen }),
    [isOpen],
  );

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      // Track citation footer opened
      posthog.capture(CHAT_UI_EVENTS.CITATION_FOOTER_OPENED, {
        source_count: sources.length,
        source_types: [...new Set(sources.map(s => s.sourceType))],
      });
    }
    setIsOpen(open);
  }, [sources, posthog]);

  if (sources.length === 0) {
    return null;
  }

  // Get unique hostnames for display
  const searchSources = sources.filter(s => s.sourceType === CitationSourceTypes.SEARCH && s.url);
  const firstHostname = searchSources.length > 0 && searchSources[0]?.url
    ? extractHostname(searchSources[0].url)
    : null;
  const extraCount = sources.length - 1;

  // Display text for trigger
  const triggerText = firstHostname
    ? (extraCount > 0 ? `${firstHostname} +${extraCount}` : firstHostname)
    : `${sources.length} ${sources.length === 1 ? 'source' : 'sources'}`;

  return (
    <InlineCitationContext value={contextValue}>
      <div className={cn('mt-4 pt-3 border-t border-border/50', className)}>
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
                'bg-muted/50 hover:bg-muted transition-colors',
                'text-sm text-muted-foreground hover:text-foreground',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              )}
            >
              <Icons.globe className="size-4" />
              <span>{triggerText}</span>
              <Icons.chevronDown className="size-3 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="z-20 w-96 p-0 backdrop-blur-lg bg-popover/95"
            align="start"
            side="bottom"
            sideOffset={8}
          >
            <div className="p-4">
              <InlineCitationCarousel>
                <InlineCitationCarouselHeader>
                  <span className="text-sm font-medium">{t('chat.citations.sources')}</span>
                  <div className="flex items-center gap-1">
                    <InlineCitationCarouselPrev />
                    <InlineCitationCarouselIndex />
                    <InlineCitationCarouselNext />
                  </div>
                </InlineCitationCarouselHeader>
                <InlineCitationCarouselContent>
                  {sources.map(source => (
                    <InlineCitationCarouselItem key={source.id}>
                      <InlineCitationSource
                        title={formatCitationIdForDisplay(source.id, source.sourceType, {
                          domain: source.domain || undefined,
                          filename: source.filename && source.filename.trim() ? source.filename : undefined,
                          title: source.title && source.title.trim() ? source.title : undefined,
                        })}
                        sourceType={source.sourceType}
                        url={source.url}
                        downloadUrl={source.downloadUrl}
                        filename={source.filename}
                        mimeType={source.mimeType}
                        fileSize={source.fileSize}
                        threadTitle={source.threadTitle}
                        citationId={source.id}
                        domain={source.domain}
                        query={source.query}
                        publishedDate={source.publishedDate}
                        author={source.author}
                        roundNumber={source.roundNumber}
                        excerpt={source.excerpt}
                        description={source.description}
                      />
                    </InlineCitationCarouselItem>
                  ))}
                </InlineCitationCarouselContent>
              </InlineCitationCarousel>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </InlineCitationContext>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if sources actually changed
  if (prevProps.className !== nextProps.className) {
    return false;
  }
  if (prevProps.sources.length !== nextProps.sources.length) {
    return false;
  }
  // Compare source IDs AND key display fields (title, filename)
  // This ensures re-render when better data becomes available
  for (let i = 0; i < prevProps.sources.length; i++) {
    const prevSource = prevProps.sources[i];
    const nextSource = nextProps.sources[i];
    if (prevSource?.id !== nextSource?.id) {
      return false;
    }
    // Also compare title and filename - these affect display
    if (prevSource?.title !== nextSource?.title) {
      return false;
    }
    if (prevSource?.filename !== nextSource?.filename) {
      return false;
    }
  }
  return true;
});

// ============================================================================
// Exports
// ============================================================================

export {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
  InlineCitationText,
  SOURCE_TYPE_CONFIG,
  SourcesFooter,
};

export type { SourceData };
