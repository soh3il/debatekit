'use client';

import { ACTIVE_GENERATION_STATUSES, ComponentSizes, ComponentVariants, PodcastStatuses } from '@debatekit/shared';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { usePublicPodcastEpisodesQuery } from '@/hooks/queries/chat/podcast';
import { useTranslations } from '@/lib/i18n';
import { useShallow } from '@/lib/store';
import { getPublicPodcastAudioUrl } from '@/services/api';
import type { PodcastData } from '@/services/api/chat/podcast';
import type { PodcastEpisode } from '@/stores/podcast/store';
import { usePodcastStore } from '@/stores/podcast/store';

const POLL_INTERVAL = 3000;

function buildPlaylistEpisodes(episodes: PodcastData[], slug: string): PodcastEpisode[] {
  return episodes.map((ep: PodcastData) => ({
    audioUrl: getPublicPodcastAudioUrl(slug, ep.roundNumber ?? undefined),
    isPartial: false,
    podcastId: ep.id,
    roundNumber: ep.roundNumber ?? undefined,
    scriptLines: ep.scriptData?.lines ?? [],
    title: ep.scriptData?.title ?? '',
  }));
}

type PublicPodcastListenButtonProps = {
  slug: string;
  threadId: string;
};

/**
 * Simplified podcast listen button for public/shared thread pages.
 * No generation trigger -- shows progress during active generation,
 * and enables listening when completed episodes exist.
 */
export function PublicPodcastListenButton({ slug, threadId }: PublicPodcastListenButtonProps) {
  const t = useTranslations('podcast');

  const isAnyGenerating = useRef(false);
  const shouldPoll = isAnyGenerating.current;

  const { data: episodesData } = usePublicPodcastEpisodesQuery(slug, {
    refetchInterval: shouldPoll ? POLL_INTERVAL : false,
  });
  const episodes = episodesData?.success ? episodesData.data : null;

  const generatingEpisodes = useMemo(
    () => episodes?.filter((ep: PodcastData) => ACTIVE_GENERATION_STATUSES.has(ep.status)) ?? [],
    [episodes],
  );
  isAnyGenerating.current = generatingEpisodes.length > 0;

  const completedEpisodes = useMemo(
    () => episodes?.filter((ep: PodcastData) => ep.status === PodcastStatuses.COMPLETED) ?? [],
    [episodes],
  );

  const isGenerating = isAnyGenerating.current;
  const totalEpisodes = episodes?.length ?? 0;

  const { loadPlaylist, setGenerationProgress, setGenerationStatus } = usePodcastStore(
    useShallow(s => ({
      loadPlaylist: s.loadPlaylist,
      setGenerationProgress: s.setGenerationProgress,
      setGenerationStatus: s.setGenerationStatus,
    })),
  );

  // Cleanup generation state on unmount / thread change
  useEffect(() => {
    return () => {
      setGenerationStatus(null, null);
      setGenerationProgress(null);
    };
  }, [threadId, setGenerationStatus, setGenerationProgress]);

  // Push generation progress to store for Dynamic Island
  useEffect(() => {
    if (episodes && episodes.length > 0) {
      setGenerationProgress({
        completed: completedEpisodes.length,
        episodes: episodes.map((ep: PodcastData) => ({
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

  // Dynamic Island: show generating status
  const prevGeneratingRef = useRef(false);
  useEffect(() => {
    if (isGenerating) {
      const activeEp = generatingEpisodes[0];
      const status = activeEp?.status ?? PodcastStatuses.PENDING;
      setGenerationStatus(status, threadId);
      prevGeneratingRef.current = true;
    } else if (prevGeneratingRef.current) {
      setGenerationStatus(null, null);
      prevGeneratingRef.current = false;
      // Auto-play completed episodes after generation finishes
      if (completedEpisodes.length > 0) {
        const playlistEps = buildPlaylistEpisodes(completedEpisodes, slug);
        loadPlaylist({ episodes: playlistEps, threadId });
      }
    }
  }, [isGenerating, generatingEpisodes, threadId, setGenerationStatus, completedEpisodes, loadPlaylist, slug]);

  const handleListen = useCallback(() => {
    if (completedEpisodes.length > 0) {
      const playlistEps = buildPlaylistEpisodes(completedEpisodes, slug);
      loadPlaylist({ episodes: playlistEps, threadId });
    }
  }, [completedEpisodes, loadPlaylist, slug, threadId]);

  // STATE 1: Generating + no completed -> disabled button with "Generating..."
  if (isGenerating && completedEpisodes.length === 0) {
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

  // STATE 2: Generating + some completed -> clickable "Listen (M/N)"
  if (isGenerating && completedEpisodes.length > 0) {
    return (
      <Button
        variant={ComponentVariants.GHOST}
        size={ComponentSizes.SM}
        onClick={handleListen}
        startIcon={<Icons.headphones />}
      >
        {t('listen')}
        {' '}
        (
        {completedEpisodes.length}
        /
        {totalEpisodes}
        )
      </Button>
    );
  }

  // STATE 3: Has completed episodes -> "Listen"
  if (completedEpisodes.length > 0) {
    return (
      <Button
        variant={ComponentVariants.GHOST}
        size={ComponentSizes.SM}
        onClick={handleListen}
        startIcon={<Icons.headphones />}
      >
        {t('listen')}
      </Button>
    );
  }

  // STATE 4: No episodes at all -> render nothing
  return null;
}
