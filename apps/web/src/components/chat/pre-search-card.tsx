import { MessageStatuses } from '@debatekit/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Icons } from '@/components/icons';
import { useChatStoreOptional } from '@/components/providers';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FadeIn } from '@/components/ui/motion';
import { queryKeys } from '@/lib/data/keys';
import { useTranslations } from '@/lib/i18n';
import { useShallow } from '@/lib/store';
import { cn } from '@/lib/ui/cn';
import type { PreSearchDataPayload, PreSearchResult, StoredPreSearch } from '@/services/api';
import { ChatPhases } from '@/stores/chat/store-schemas';

import { PreSearchStream } from './pre-search-stream';

// Stable no-op functions for read-only contexts without ChatStoreProvider
function NOOP() {}

type PreSearchCardProps = {
  threadId: string;
  preSearch: StoredPreSearch;
  className?: string;
  streamingRoundNumber?: number | null;
  demoOpen?: boolean;
  demoShowContent?: boolean;
};

export function PreSearchCard({
  className,
  demoOpen,
  demoShowContent,
  preSearch,
  streamingRoundNumber,
  threadId,
}: PreSearchCardProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Use optional store hook - returns undefined on public pages without ChatStoreProvider
  const storeData = useChatStoreOptional(
    useShallow(s => ({
      phase: s.phase,
      updatePreSearchData: s.updatePreSearchData,
      updatePreSearchStatus: s.updatePreSearchStatus,
    })),
  );

  // Fallback values for read-only pages (public threads) without ChatStoreProvider
  const updatePreSearchStatus = storeData?.updatePreSearchStatus ?? NOOP;
  const updatePreSearchData = storeData?.updatePreSearchData ?? NOOP;
  const currentPhase = storeData?.phase ?? ChatPhases.IDLE;

  const isStreamingOrPending = preSearch.status === MessageStatuses.PENDING || preSearch.status === MessageStatuses.STREAMING;
  const hasError = preSearch.status === MessageStatuses.FAILED;

  // Determine if we're past the presearch phase (participants, moderator, or complete)
  // Used to auto-collapse the accordion when phase transitions from PRESEARCH to PARTICIPANTS
  const isPastPresearchPhaseRaw = currentPhase === ChatPhases.PARTICIPANTS
    || currentPhase === ChatPhases.MODERATOR
    || currentPhase === ChatPhases.COMPLETE;

  // Delay the auto-collapse by 1.5s after presearch completes so the user can see results
  // before participants start streaming. Without this delay, the card collapses immediately
  // when the phase transitions to PARTICIPANTS and the user never sees the presearch content.
  const [isPastPresearchPhase, setIsPastPresearchPhase] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPastPresearchPhaseRaw && !isStreamingOrPending) {
      collapseTimerRef.current = setTimeout(() => {
        setIsPastPresearchPhase(true);
      }, 1500);
    } else {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- intentional reset when conditions change
      setIsPastPresearchPhase(false);
    }
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, [isPastPresearchPhaseRaw, isStreamingOrPending]);

  const [manualControl, setManualControl] = useState<{ round: number; open: boolean } | null>(null);

  // Manual control stays valid for the same round. Only invalidate when a
  // completely new round begins (streamingRoundNumber advances), which means
  // the previous round's manual toggle no longer applies.
  const isManualControlValid = useMemo(() => {
    if (!manualControl) {
      return false;
    }
    // Invalidate only when a NEW round starts, not when same round changes phase
    if (streamingRoundNumber !== null && streamingRoundNumber !== undefined && streamingRoundNumber > manualControl.round) {
      return false;
    }
    return true;
  }, [manualControl, streamingRoundNumber]);

  const handleStreamComplete = useCallback((completedData?: PreSearchDataPayload) => {
    if (!completedData) {
      return;
    }

    updatePreSearchData(preSearch.roundNumber, completedData);
    updatePreSearchStatus(preSearch.roundNumber, MessageStatuses.COMPLETE);

    queryClient.invalidateQueries({
      queryKey: queryKeys.threads.preSearches(threadId),
    });
  }, [threadId, preSearch.roundNumber, updatePreSearchData, updatePreSearchStatus, queryClient]);

  // Track whether search was already complete on first render (SSR hydration).
  // If it was, default to collapsed — the "keep open" logic only applies
  // when the user watched the search finish live during this session.
  const wasCompleteOnMount = useRef(
    preSearch.status === MessageStatuses.COMPLETE || preSearch.status === MessageStatuses.FAILED,
  );

  const totalSources = useMemo(() => {
    if (!preSearch.searchData?.results) {
      return 0;
    }
    return preSearch.searchData.results.reduce(
      (sum: number, r: PreSearchResult) => sum + (r.results?.length || 0),
      0,
    );
  }, [preSearch.searchData]);

  const handleOpenChange = useCallback((open: boolean) => {
    setManualControl({ open, round: preSearch.roundNumber });
  }, [preSearch.roundNumber]);

  // Determine if presearch has results to show
  const hasResults = useMemo(() => {
    return totalSources > 0 || (preSearch.searchData?.queries?.length ?? 0) > 0;
  }, [totalSources, preSearch.searchData?.queries?.length]);

  // Read-only context (public pages) — no ChatStoreProvider available
  const isReadOnly = !storeData;

  const isOpen = useMemo(() => {
    // Demo mode takes precedence
    if (demoOpen !== undefined) {
      return demoOpen;
    }
    // User's manual control (clicking collapse/expand) ALWAYS takes precedence
    // over any automatic behavior for the current round. This ensures that when
    // a user re-expands a collapsed presearch card, it stays open.
    if (isManualControlValid && manualControl) {
      return manualControl.open;
    }
    // Public/read-only pages default to collapsed
    if (isReadOnly) {
      return false;
    }
    // Auto-open while streaming or pending
    if (isStreamingOrPending) {
      return true;
    }
    // Auto-collapse when phase transitions past PRESEARCH to PARTICIPANTS/MODERATOR/COMPLETE
    // This ensures the web search accordion collapses when participants start streaming
    if (isPastPresearchPhase) {
      return false;
    }
    // Keep open when complete with results but still in PRESEARCH/IDLE phase,
    // ONLY if the search completed during this session (not on initial page load).
    // On SSR hydration, already-complete searches load collapsed.
    if (!wasCompleteOnMount.current && preSearch.status === MessageStatuses.COMPLETE && hasResults) {
      return true;
    }
    return false;
  }, [demoOpen, isReadOnly, isStreamingOrPending, isManualControlValid, manualControl, preSearch.status, hasResults, isPastPresearchPhase]);

  return (
    <div className={cn('w-full mb-5', className)}>
      <div className="flex items-center gap-3 mb-6">
        <div className="size-8 flex items-center justify-center rounded-full bg-blue-500/20 shrink-0">
          <Icons.globe className="size-4 text-blue-300" />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl font-semibold text-muted-foreground">
            {t('chat.preSearch.title')}
          </span>

          {isStreamingOrPending && (
            <span className="size-1.5 rounded-full bg-primary/60 animate-pulse shrink-0" />
          )}

          {hasError && (
            <span className="size-1.5 rounded-full bg-destructive/80 shrink-0" />
          )}
        </div>
      </div>

      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <CollapsibleTrigger
          className={cn(
            'flex items-center gap-1.5 text-muted-foreground text-sm cursor-pointer',
            'hover:text-foreground transition-colors',
          )}
        >
          <Icons.chevronRight
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
          />
          <span className="font-medium">
            {isStreamingOrPending
              ? t('chat.preSearch.searching')
              : t('chat.preSearch.searchedSources', { count: totalSources })}
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3">
          {(demoShowContent === undefined || demoShowContent) && (
            isStreamingOrPending
              ? (
                  // During streaming/pending: render content immediately without FadeIn.
                  // FadeIn starts at opacity:0 which causes Radix to measure 0 content height
                  // during the collapsible-down animation, resulting in a 0-height panel.
                  <div className="space-y-4 min-h-[60px]">
                    <PreSearchStream
                      threadId={threadId}
                      preSearch={preSearch}
                      onStreamComplete={handleStreamComplete}
                    />
                  </div>
                )
              : (
                  <FadeIn duration={0.25}>
                    <div className="space-y-4">
                      {!hasError && (
                        <PreSearchStream
                          threadId={threadId}
                          preSearch={preSearch}
                          onStreamComplete={handleStreamComplete}
                        />
                      )}

                      {hasError && preSearch.errorMessage && (
                        <div className="flex items-center gap-2 py-1.5 text-xs text-destructive">
                          <span className="size-1.5 rounded-full bg-destructive/80" />
                          <span>{preSearch.errorMessage}</span>
                        </div>
                      )}
                    </div>
                  </FadeIn>
                )
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
