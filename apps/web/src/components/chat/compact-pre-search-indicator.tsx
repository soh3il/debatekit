/**
 * Compact Pre-Search Indicator -- ChatGPT-style collapsible accordion.
 *
 * During streaming: auto-expanded, shows domain pills as they arrive (animated).
 * After complete: auto-collapsed to "Searched X sites", expandable to see source domains.
 * No search query text shown in either state -- only favicons + domain names.
 */
import type { PresearchResultData } from '@debatekit/shared';
import { CitationSourceTypes, MessageStatuses } from '@debatekit/shared';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { TextShimmer } from '@/components/ai-elements/shimmer';
import { Icons } from '@/components/icons';
import { useChatStoreOptional } from '@/components/providers/chat-store-provider/context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAvailableSourcesArtifact } from '@/hooks/streaming/artifacts/use-available-sources-artifact';
import { usePresearchArtifact } from '@/hooks/streaming/artifacts/use-presearch-artifact';
import { useTranslations } from '@/lib/i18n';
import { useShallow } from '@/lib/store';
import { cn } from '@/lib/ui/cn';
import { buildGoogleFaviconUrl, safeExtractDomain } from '@/lib/utils/web-search-utils';
import type { PreSearchDataPayload, StoredPreSearch } from '@/services/api';
import { ChatPhases } from '@/stores/chat/store-schemas';

// SSR-safe client detection (same pattern as motion.tsx)
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// Stable no-op for read-only contexts without ChatStoreProvider
const NOOP = () => false;

const COLLAPSE_DELAY_MS = 1500;

type DomainEntry = { domain: string; faviconUrl: string };

type CompactPreSearchIndicatorProps = {
  preSearch: StoredPreSearch;
  className?: string;
};

/** Extract ALL unique domains across all results (flat list for both streaming and completed states) */
function useAllUniqueDomains(preSearch: StoredPreSearch) {
  return useMemo(() => {
    const searchData = preSearch.searchData;
    if (!searchData?.results) {
      return [];
    }

    const seen = new Set<string>();
    const domains: DomainEntry[] = [];

    for (const result of searchData.results) {
      if (!result.results) {
        continue;
      }
      for (const item of result.results) {
        const domain = item.domain || safeExtractDomain(item.url);
        if (domain && !seen.has(domain)) {
          seen.add(domain);
          domains.push({ domain, faviconUrl: buildGoogleFaviconUrl(domain, 32) });
        }
      }
    }

    return domains;
  }, [preSearch.searchData]);
}

/** Extract unique domains from artifact streaming results */
function useArtifactDomains(artifactResults: PresearchResultData[]) {
  return useMemo(() => {
    if (artifactResults.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const domains: DomainEntry[] = [];

    for (const result of artifactResults) {
      if (!result.results) {
        continue;
      }
      for (const item of result.results) {
        const domain = safeExtractDomain(item.url);
        if (domain && !seen.has(domain)) {
          seen.add(domain);
          domains.push({ domain, faviconUrl: item.favicon || buildGoogleFaviconUrl(domain, 32) });
        }
      }
    }

    return domains;
  }, [artifactResults]);
}

function CompactPreSearchIndicatorComponent({
  className,
  preSearch,
}: CompactPreSearchIndicatorProps) {
  const t = useTranslations('chat.preSearch');
  const isClient = useIsClient();

  // Optional store access (handles public pages without ChatStoreProvider)
  const storeData = useChatStoreOptional(
    useShallow(s => ({
      domainSourceProgress: s.domainSourceProgress,
      hasPreSearchBeenTriggered: s.hasPreSearchBeenTriggered,
      markPreSearchTriggered: s.markPreSearchTriggered,
      phase: s.phase,
      updatePreSearchData: s.updatePreSearchData,
    })),
  );

  const markPreSearchTriggered = storeData?.markPreSearchTriggered ?? NOOP;
  const currentPhase = storeData?.phase ?? ChatPhases.IDLE;

  // Preserve markPreSearchTriggered effect (from pre-search-stream.tsx)
  useEffect(() => {
    const roundAlreadyMarked = storeData?.hasPreSearchBeenTriggered(preSearch.roundNumber) ?? false;
    if (
      !roundAlreadyMarked
      && (preSearch.status === MessageStatuses.COMPLETE
        || preSearch.status === MessageStatuses.FAILED)
    ) {
      markPreSearchTriggered(preSearch.roundNumber);
    }
  }, [storeData, preSearch.roundNumber, preSearch.status, markPreSearchTriggered]);

  const isStreamingOrPending
    = (preSearch.status === MessageStatuses.PENDING
      || preSearch.status === MessageStatuses.STREAMING)
    && currentPhase !== ChatPhases.COMPLETE
    && currentPhase !== ChatPhases.IDLE;
  const hasError = preSearch.status === MessageStatuses.FAILED;

  // Artifact-based streaming data — live from @ai-sdk-tools/artifacts message parts
  const { queries: artifactQueries, results: artifactResults, summary: artifactSummary, totalResults: artifactTotalResults } = usePresearchArtifact();

  // Domain sources from available-sources artifact (SEC EDGAR, PubMed, etc.)
  const { sources: availableSources } = useAvailableSourcesArtifact();

  const domainSourceEntries = useMemo(() => {
    const entries: DomainEntry[] = [];
    const seen = new Set<string>();
    for (const source of availableSources) {
      if (source.sourceType === CitationSourceTypes.DOMAIN && source.domain && !seen.has(source.domain)) {
        seen.add(source.domain);
        entries.push({ domain: source.domain, faviconUrl: buildGoogleFaviconUrl(source.domain, 32) });
      }
    }
    return entries;
  }, [availableSources]);

  const domainSourceCount = useMemo(() => {
    return availableSources.filter(s => s.sourceType === CitationSourceTypes.DOMAIN).length;
  }, [availableSources]);

  // Compute domains from both sources
  const storeDomains = useAllUniqueDomains(preSearch);
  const artDomains = useArtifactDomains(artifactResults);

  // Prefer artifact data when available (streaming + post-completion in same session),
  // fall back to store data (loaded from DB on page refresh)
  const webDomains = artDomains.length > 0 ? artDomains : storeDomains;
  const allDomains = useMemo(() => {
    const seen = new Set(webDomains.map(d => d.domain));
    const merged = [...webDomains];
    for (const entry of domainSourceEntries) {
      if (!seen.has(entry.domain)) {
        merged.push(entry);
        seen.add(entry.domain);
      }
    }
    return merged;
  }, [webDomains, domainSourceEntries]);

  const artifactTotalSources = useMemo(() => {
    return artifactResults.reduce((sum, r) => sum + (r.results?.length || 0), 0);
  }, [artifactResults]);

  const storeTotalSources = useMemo(() => {
    if (!preSearch.searchData?.results) {
      return 0;
    }
    return preSearch.searchData.results.reduce(
      (sum, r) => sum + (r.results?.length || 0),
      0,
    );
  }, [preSearch.searchData]);

  const webSearchSources = artifactTotalSources > 0 ? artifactTotalSources : storeTotalSources;
  const totalSources = webSearchSources + domainSourceCount;

  // Bridge artifact data → Zustand store when presearch completes.
  // Ensures store has searchData for memo comparisons and page refresh fallback.
  const bridgedRef = useRef(false);
  useEffect(() => {
    if (
      artifactResults.length > 0
      && preSearch.status === MessageStatuses.COMPLETE
      && !preSearch.searchData
      && storeData?.updatePreSearchData
      && !bridgedRef.current
    ) {
      bridgedRef.current = true;
      const bridgedData: PreSearchDataPayload = {
        failureCount: 0,
        queries: artifactQueries.map(q => ({
          index: q.index,
          query: q.query,
          rationale: q.rationale,
          searchDepth: q.searchDepth,
          total: q.total,
        })),
        results: artifactResults.map(r => ({
          answer: r.answer,
          index: r.index,
          query: r.query,
          responseTime: r.responseTime,
          results: r.results.map((item) => {
            const domain = safeExtractDomain(item.url);
            return {
              content: item.snippet || item.description || '',
              domain,
              metadata: { description: item.description, faviconUrl: item.favicon },
              publishedDate: null,
              score: 0,
              title: item.title,
              url: item.url,
            };
          }),
        })),
        successCount: artifactResults.length,
        summary: artifactSummary,
        totalResults: artifactTotalResults,
        totalTime: 0,
      };
      storeData.updatePreSearchData(preSearch.roundNumber, bridgedData);
    }
  }, [artifactResults, artifactQueries, artifactSummary, artifactTotalResults, preSearch.status, preSearch.searchData, preSearch.roundNumber, storeData]);

  // --- Open/close logic (mirrors PreSearchCard patterns) ---

  const isPastPresearchPhaseRaw = currentPhase === ChatPhases.PARTICIPANTS
    || currentPhase === ChatPhases.MODERATOR
    || currentPhase === ChatPhases.COMPLETE;

  const [isPastPresearchPhase, setIsPastPresearchPhase] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPastPresearchPhaseRaw && !isStreamingOrPending) {
      collapseTimerRef.current = setTimeout(() => {
        setIsPastPresearchPhase(true);
      }, COLLAPSE_DELAY_MS);
    } else {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- intentional reset
      setIsPastPresearchPhase(false);
    }
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, [isPastPresearchPhaseRaw, isStreamingOrPending]);

  const [manualOpen, setManualOpen] = useState<boolean | null>(null);

  const wasCompleteOnMount = useRef(
    preSearch.status === MessageStatuses.COMPLETE || preSearch.status === MessageStatuses.FAILED,
  );

  // Domain source progress — must be declared before isOpen which depends on totalSourcesWithDomain
  const domainSourceProgress = storeData?.domainSourceProgress ?? [];
  const hasDomainSources = domainSourceProgress.length > 0;
  const hasWebSearchActivity = artifactQueries.length > 0 || artifactResults.length > 0;
  const completedDomainSources = domainSourceProgress.filter(d => d.status === 'complete');
  const failedDomainSources = domainSourceProgress.filter(d => d.status === 'error');
  const totalSourcesWithDomain = totalSources + completedDomainSources.length;

  const isOpen = useMemo(() => {
    if (manualOpen !== null) {
      return manualOpen;
    }
    if (isStreamingOrPending) {
      return true;
    }
    if (isPastPresearchPhase) {
      return false;
    }
    if (!wasCompleteOnMount.current && preSearch.status === MessageStatuses.COMPLETE && totalSourcesWithDomain > 0) {
      return true;
    }
    return false;
  }, [manualOpen, isStreamingOrPending, isPastPresearchPhase, preSearch.status, totalSourcesWithDomain]);

  const handleOpenChange = useCallback((open: boolean) => {
    setManualOpen(open);
  }, []);

  useEffect(() => {
    if (isStreamingOrPending) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- reset on new round
      setManualOpen(null);
    }
  }, [isStreamingOrPending]);

  const skipAnimations = !isClient;

  const triggerLabel = isStreamingOrPending
    ? (hasDomainSources && hasWebSearchActivity)
        ? 'Searching & checking sources...'
        : hasDomainSources
          ? 'Checking sources...'
          : t('pendingSearch')
    : hasError
      ? t('searchFailed')
      : totalSourcesWithDomain > 0
        ? (webSearchSources === 0 && completedDomainSources.length > 0)
            ? `Checked ${completedDomainSources.map(d => d.label).join(', ')}`
            : t('searchedSources', { count: totalSourcesWithDomain })
        : t('searchedSources', { count: 0 });

  return (
    <div className={cn('w-full', className)}>
      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <CollapsibleTrigger
          className={cn(
            'flex items-center gap-1.5 text-sm cursor-pointer',
            'hover:text-foreground transition-colors',
            hasError ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          <Icons.chevronRight
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
          />
          {isStreamingOrPending
            ? <TextShimmer className="text-sm font-medium">{triggerLabel}</TextShimmer>
            : <span className="font-medium">{triggerLabel}</span>}
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2">
          {/* STREAMING: domain source progress + web search domain pills */}
          {isStreamingOrPending && (
            <div className="pl-5 space-y-2">
              {/* Domain source progress indicators */}
              {domainSourceProgress.length > 0 && (
                <div className="flex flex-col gap-1">
                  <AnimatePresence initial={!skipAnimations}>
                    {domainSourceProgress.map((ds, i) => (
                      <motion.div
                        key={ds.sourceId}
                        initial={skipAnimations ? false : { opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.15 }}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        {ds.status === 'start' && (
                          <TextShimmer className="text-xs text-muted-foreground">
                            {`Checking ${ds.label}...`}
                          </TextShimmer>
                        )}
                        {ds.status === 'complete' && (
                          <span className="flex items-center gap-1 text-muted-foreground/70">
                            <Icons.check className="size-3 text-emerald-500" />
                            {ds.label}
                          </span>
                        )}
                        {ds.status === 'error' && (
                          <span className="flex items-center gap-1 text-muted-foreground/50">
                            <Icons.alertTriangle className="size-3 text-amber-500" />
                            {`${ds.label} unavailable`}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Web search domain pills (hidden when only domain sources active) */}
              {(hasWebSearchActivity || allDomains.length > 0 || domainSourceProgress.length === 0) && (
                <div className="flex items-center gap-2 flex-wrap min-h-[24px]">
                  <AnimatePresence initial={!skipAnimations}>
                    {allDomains.length === 0 && domainSourceProgress.length === 0 && (
                      <motion.div
                        key="search-placeholder"
                        initial={false}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        className="flex items-center gap-2"
                      >
                        {Array.from({ length: 3 }, (_, i) => (
                          <span
                            key={i}
                            className="size-3 rounded bg-muted/60 animate-pulse"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </motion.div>
                    )}
                    {allDomains.map((d, i) => (
                      <motion.span
                        key={d.domain}
                        initial={skipAnimations ? false : { opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04, duration: 0.15 }}
                      >
                        <DomainPill entry={d} />
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* COMPLETED: static content -- no motion wrappers so Radix always
              measures correct height when the collapsible re-opens */}
          {!isStreamingOrPending && !hasError && (
            <div className="pl-5 space-y-2">
              {/* Completed domain sources */}
              {completedDomainSources.length > 0 && (
                <div className="flex flex-col gap-1">
                  {completedDomainSources.map(ds => (
                    <span key={ds.sourceId} className="flex items-center gap-1 text-xs text-muted-foreground/70">
                      <Icons.check className="size-3 text-emerald-500" />
                      {ds.label}
                    </span>
                  ))}
                  {failedDomainSources.map(ds => (
                    <span key={ds.sourceId} className="flex items-center gap-1 text-xs text-muted-foreground/50">
                      <Icons.alertTriangle className="size-3 text-amber-500" />
                      {`${ds.label} unavailable`}
                    </span>
                  ))}
                </div>
              )}
              {/* Web search domains */}
              {allDomains.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {allDomains.map(d => (
                    <DomainPill key={d.domain} entry={d} />
                  ))}
                </div>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** Small favicon + domain text — no animation wrapper */
function DomainPill({ entry }: { entry: DomainEntry }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/70">
      <Avatar className="size-3.5">
        <AvatarImage src={entry.faviconUrl} alt={entry.domain} />
        <AvatarFallback className="text-[7px] animate-none bg-muted/30">
          {entry.domain.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {entry.domain}
    </span>
  );
}

export const CompactPreSearchIndicator = memo(
  CompactPreSearchIndicatorComponent,
  (prev, next) =>
    prev.preSearch.id === next.preSearch.id
    && prev.preSearch.status === next.preSearch.status
    && prev.preSearch.searchData === next.preSearch.searchData,
);
