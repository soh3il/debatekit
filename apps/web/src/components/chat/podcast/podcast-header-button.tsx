'use client';

import { ACTIVE_GENERATION_STATUSES, ComponentSizes, ComponentVariants, PodcastStatuses } from '@debatekit/shared';
import { UserRoles } from '@debatekit/shared/enums';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useEnablePodcastMutation } from '@/hooks/mutations/podcast-mutations';
import { usePodcastEpisodesQuery } from '@/hooks/queries/chat/podcast';
import { useSession } from '@/lib/auth/client';
import { useTranslations } from '@/lib/i18n';
import { useShallow } from '@/lib/store';
import { getPodcastAudioUrl } from '@/services/api';
import type { PodcastData } from '@/services/api/chat/podcast';
import type { PodcastEpisode } from '@/stores/podcast/store';
import { usePodcastStore } from '@/stores/podcast/store';

const POLL_INTERVAL = 3000;
/** Safety timeout -- only fires if backend never acknowledges generation */
const AWAITING_TIMEOUT = 60_000;

type PodcastHeaderButtonProps = {
  disabled?: boolean;
  threadId: string;
};

/**
 * Check if an episode has partial audio available for progressive playback.
 * True when audio is being generated and some bytes have been uploaded to R2.
 */
function hasPartialAudio(ep: PodcastData): boolean {
  return ep.status === PodcastStatuses.GENERATING_AUDIO
    && (ep.progress ?? 0) > 5
    && (ep.audioSizeBytes ?? 0) > 0;
}

function buildPlaylistEpisodes(episodes: PodcastData[]): PodcastEpisode[] {
  return episodes.map((ep) => {
    const isPartial = hasPartialAudio(ep);
    const baseUrl = getPodcastAudioUrl(ep.threadId, ep.scope, ep.roundNumber ?? undefined);
    // Cache-bust partial audio URLs so the browser re-fetches updated content
    const audioUrl = isPartial ? `${baseUrl}&v=${ep.audioSizeBytes}` : baseUrl;
    return {
      audioUrl,
      isPartial,
      podcastId: ep.id,
      roundNumber: ep.roundNumber ?? undefined,
      scriptLines: ep.scriptData?.lines ?? [],
      title: ep.scriptData?.title ?? '',
    };
  });
}

/**
 * Defense-in-depth: even though the parent hides this for non-admins,
 * gate rendering so no hooks run for non-admin users.
 */
export function PodcastHeaderButton(props: PodcastHeaderButtonProps) {
  const { data: session } = useSession();
  if (session?.user?.role !== UserRoles.ADMIN) {
    return null;
  }
  return <PodcastHeaderButtonInner {...props} />;
}

function PodcastHeaderButtonInner({ disabled, threadId }: PodcastHeaderButtonProps) {
  const t = useTranslations('podcast');
  const enableMutation = useEnablePodcastMutation();

  // Optimistic "awaiting generation" -- set on click, cleared when backend acknowledges
  const [awaitingGeneration, setAwaitingGeneration] = useState(false);
  const awaitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived state from episodes query
  const isAnyGenerating = useRef(false);
  const prevFingerprintRef = useRef('');
  // Track whether we've already auto-started playback during this generation
  const autoPlayStartedRef = useRef(false);

  // Poll while awaiting or any episode is actively generating
  const shouldPoll = awaitingGeneration || isAnyGenerating.current;

  const { data: episodesData } = usePodcastEpisodesQuery(threadId, {
    refetchInterval: shouldPoll ? POLL_INTERVAL : false,
  });
  const episodes = episodesData?.success ? episodesData.data : null;

  // Compute derived state (memoized for stable effect deps)
  const generatingEpisodes = useMemo(
    () => episodes?.filter(ep => ACTIVE_GENERATION_STATUSES.has(ep.status)) ?? [],
    [episodes],
  );
  isAnyGenerating.current = generatingEpisodes.length > 0;
  const completedEpisodes = useMemo(
    () => episodes?.filter(ep => ep.status === PodcastStatuses.COMPLETED) ?? [],
    [episodes],
  );
  const partialEpisodes = useMemo(
    () => episodes?.filter(hasPartialAudio) ?? [],
    [episodes],
  );
  const playableEpisodes = useMemo(
    () => [...completedEpisodes, ...partialEpisodes],
    [completedEpisodes, partialEpisodes],
  );
  const failedEpisodes = useMemo(
    () => episodes?.filter(ep => ep.status === PodcastStatuses.FAILED) ?? [],
    [episodes],
  );
  const hasPlayableEpisodes = playableEpisodes.length > 0;
  const allFailed = failedEpisodes.length > 0 && playableEpisodes.length === 0 && generatingEpisodes.length === 0;
  const isGenerating = awaitingGeneration || isAnyGenerating.current;
  const totalEpisodes = episodes?.length ?? 0;

  // Clear awaiting state when backend acknowledges (episodes exist)
  useEffect(() => {
    if (episodes && episodes.length > 0 && awaitingGeneration) {
      if (awaitingTimeoutRef.current) {
        clearTimeout(awaitingTimeoutRef.current);
        awaitingTimeoutRef.current = null;
      }
      setAwaitingGeneration(false);
    }
  }, [episodes, awaitingGeneration]);

  // Store actions
  const { loadPlaylist, setGenerationProgress, setGenerationStatus, updatePlaylistLive } = usePodcastStore(
    useShallow(s => ({
      loadPlaylist: s.loadPlaylist,
      setGenerationProgress: s.setGenerationProgress,
      setGenerationStatus: s.setGenerationStatus,
      updatePlaylistLive: s.updatePlaylistLive,
    })),
  );

  // Cleanup timeout + generation state on unmount / thread change
  useEffect(() => {
    return () => {
      if (awaitingTimeoutRef.current) {
        clearTimeout(awaitingTimeoutRef.current);
      }
      // Clear Dynamic Island generation overlay when leaving thread
      setGenerationStatus(null, null);
      setGenerationProgress(null);
    };
  }, [threadId, setGenerationStatus, setGenerationProgress]);

  // Push generation progress to store
  useEffect(() => {
    if (episodes && episodes.length > 0) {
      setGenerationProgress({
        completed: completedEpisodes.length,
        episodes: episodes.map(ep => ({
          episodeTitle: ep.episodeTitle ?? null,
          errorMessage: ep.errorMessage ?? null,
          progress: ep.progress ?? 0,
          roundNumber: ep.roundNumber ?? null,
          status: ep.status,
        })),
        total: episodes.length,
      });
    } else if (!isGenerating) {
      setGenerationProgress(null);
    }
  }, [episodes, completedEpisodes.length, isGenerating, setGenerationProgress]);

  // Dynamic Island: show generating / failed status
  const prevGeneratingRef = useRef(false);
  useEffect(() => {
    if (isGenerating) {
      const activeEp = generatingEpisodes[0];
      const status = activeEp?.status ?? PodcastStatuses.PENDING;
      setGenerationStatus(status, threadId);
      prevGeneratingRef.current = true;
    } else if (allFailed) {
      // Keep Dynamic Island visible with failed state
      setGenerationStatus(PodcastStatuses.FAILED, threadId);
      prevGeneratingRef.current = true;
    } else if (prevGeneratingRef.current) {
      setGenerationStatus(null, null);
      prevGeneratingRef.current = false;
      // Sync final episodes without resetting playback (updatePlaylistLive preserves currentTime/audioUrl)
      if (playableEpisodes.length > 0) {
        const playlistEps = buildPlaylistEpisodes(playableEpisodes);
        updatePlaylistLive({ episodes: playlistEps, threadId });
      }
    }
  }, [isGenerating, allFailed, generatingEpisodes, threadId, setGenerationStatus, playableEpisodes, updatePlaylistLive]);

  // Auto-play first partial episode as soon as it becomes available during generation
  useEffect(() => {
    if (isGenerating && hasPlayableEpisodes && !autoPlayStartedRef.current) {
      autoPlayStartedRef.current = true;
      const playlistEps = buildPlaylistEpisodes(playableEpisodes);
      loadPlaylist({ episodes: playlistEps, threadId });
    }
  }, [isGenerating, hasPlayableEpisodes, playableEpisodes, loadPlaylist, threadId]);

  // Stable fingerprint to avoid re-render thrashing for partial episodes
  const playableFingerprint = useMemo(
    () => playableEpisodes.map(ep => `${ep.id}:${ep.audioSizeBytes ?? 0}`).join(','),
    [playableEpisodes],
  );

  // Live playlist updates -- when playable episodes change, update player
  useEffect(() => {
    if (playableEpisodes.length > 0 && playableFingerprint !== prevFingerprintRef.current) {
      prevFingerprintRef.current = playableFingerprint;
      const playlistEps = buildPlaylistEpisodes(playableEpisodes);
      updatePlaylistLive({ episodes: playlistEps, threadId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playableFingerprint, threadId, updatePlaylistLive]);

  const handleListen = useCallback(() => {
    if (playableEpisodes.length > 0) {
      const playlistEps = buildPlaylistEpisodes(playableEpisodes);
      loadPlaylist({ episodes: playlistEps, threadId });
    }
  }, [playableEpisodes, loadPlaylist, threadId]);

  const handleEnable = useCallback(() => {
    // Guard duplicate generation
    if (isGenerating || isAnyGenerating.current) {
      return;
    }

    // Optimistically show generating state immediately
    setAwaitingGeneration(true);
    autoPlayStartedRef.current = false;
    setGenerationStatus(PodcastStatuses.PENDING, threadId);

    // Safety timeout -- only fires if backend never acknowledges
    awaitingTimeoutRef.current = setTimeout(() => {
      setAwaitingGeneration(false);
      setGenerationStatus(null, null);
      awaitingTimeoutRef.current = null;
    }, AWAITING_TIMEOUT);

    enableMutation.mutate({ threadId });
  }, [enableMutation, threadId, setGenerationStatus, isGenerating]);

  // STATE 1: Generating + no playable -> disabled button with headset icon + "Generating..."
  if (isGenerating && !hasPlayableEpisodes) {
    return (
      <Button
        variant={ComponentVariants.GHOST}
        size={ComponentSizes.SM}
        disabled
        loading
        startIcon={<Icons.headphones />}
      >
        {t('generating')}
      </Button>
    );
  }

  // STATE 2: Generating + some playable -> clickable "Listen (M/N)"
  if (isGenerating && hasPlayableEpisodes) {
    return (
      <Button
        variant={ComponentVariants.GHOST}
        size={ComponentSizes.SM}
        onClick={handleListen}
        disabled={disabled}
        startIcon={<Icons.headphones />}
      >
        {t('listen')}
        {' '}
        (
        {playableEpisodes.length}
        /
        {totalEpisodes}
        )
      </Button>
    );
  }

  // STATE 3: Has playable episodes -> "Listen"
  if (hasPlayableEpisodes) {
    return (
      <Button
        variant={ComponentVariants.GHOST}
        size={ComponentSizes.SM}
        onClick={handleListen}
        disabled={disabled}
        startIcon={<Icons.headphones />}
      >
        {t('listen')}
      </Button>
    );
  }

  // STATE 4: No episodes -> enable podcast
  return (
    <Button
      variant={ComponentVariants.GHOST}
      size={ComponentSizes.SM}
      onClick={handleEnable}
      disabled={disabled || enableMutation.isPending}
      startIcon={<Icons.headphones />}
    >
      {t('listen')}
    </Button>
  );
}
