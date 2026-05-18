/**
 * Podcast Player Store
 *
 * Zustand store for podcast playback state management.
 * Controls audio playback, Dynamic Island expansion, speaker tracking,
 * and playlist/episode navigation.
 *
 * Uses custom createStore from @/lib/store (vanilla pub-sub pattern).
 */

import type { PodcastStatus } from '@debatekit/shared/enums';
import { PodcastStatusSchema } from '@debatekit/shared/enums';
import { z } from 'zod';

import { createStore, useStore } from '@/lib/store';
import { PodcastScriptLineSchema } from '@/services/api/chat/podcast';

// ============================================================================
// EPISODE SCHEMA - Individual podcast episode in a playlist
// ============================================================================

const PodcastEpisodeSchema = z.object({
  audioUrl: z.string(),
  isPartial: z.boolean().default(false),
  podcastId: z.string(),
  roundNumber: z.number().optional(),
  scriptLines: z.array(PodcastScriptLineSchema),
  title: z.string(),
});

export type PodcastEpisode = z.infer<typeof PodcastEpisodeSchema>;

// ============================================================================
// GENERATION PROGRESS - Per-episode progress tracking
// ============================================================================

const GenerationProgressEpisodeSchema = z.object({
  episodeTitle: z.string().nullable(),
  errorMessage: z.string().nullable(),
  progress: z.number(),
  roundNumber: z.number().nullable(),
  status: PodcastStatusSchema,
});

const GenerationProgressSchema = z.object({
  completed: z.number(),
  episodes: z.array(GenerationProgressEpisodeSchema),
  total: z.number(),
});

export type GenerationProgress = z.infer<typeof GenerationProgressSchema>;

// ============================================================================
// STATE TYPES (Zod-First Pattern)
// ============================================================================

export const PodcastPlayerStateSchema = z.object({
  audioError: z.string().nullable(),
  audioUrl: z.string().nullable(),
  currentEpisodeIndex: z.number(),
  currentSpeakerIndex: z.number(),
  currentTime: z.number(),
  duration: z.number(),
  episodes: z.array(PodcastEpisodeSchema),
  generationProgress: GenerationProgressSchema.nullable(),
  generationStartedAt: z.number().nullable(),
  generationStatus: PodcastStatusSchema.nullable(),
  generationThreadId: z.string().nullable(),
  hoveredSegmentIndex: z.number().nullable(),
  isBuffering: z.boolean(),
  isExpanded: z.boolean(),
  isPlaying: z.boolean(),
  isPlaylist: z.boolean(),
  isVisible: z.boolean(),
  playbackRate: z.number(),
  podcastId: z.string().nullable(),
  scriptLines: z.array(PodcastScriptLineSchema),
  threadId: z.string().nullable(),
  volume: z.number(),
});

export type PodcastPlayerState = z.infer<typeof PodcastPlayerStateSchema>;

type PodcastPlayerActions = {
  closePodcast: () => void;
  loadPlaylist: (params: LoadPlaylistParams) => void;
  loadPodcast: (params: LoadPodcastParams) => void;
  nextEpisode: () => void;
  pause: () => void;
  play: () => void;
  playEpisodeAtIndex: (index: number) => void;
  previousEpisode: () => void;
  seek: (time: number) => void;
  setAudioError: (error: string | null) => void;
  setBuffering: (buffering: boolean) => void;
  setGenerationProgress: (progress: GenerationProgress | null) => void;
  setGenerationStatus: (status: PodcastStatus | null, threadId: string | null) => void;
  setHoveredSegment: (index: number | null) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleExpanded: () => void;
  togglePlayPause: () => void;
  updateCurrentSpeaker: (index: number) => void;
  updateCurrentTime: (time: number) => void;
  updateDuration: (duration: number) => void;
  updatePlaylistLive: (params: LoadPlaylistParams) => void;
};

export type PodcastPlayerStore = PodcastPlayerActions & PodcastPlayerState;

// ============================================================================
// LOAD PODCAST / PLAYLIST PARAMS
// ============================================================================

const _LoadPodcastParamsSchema = z.object({
  audioUrl: z.string(),
  podcastId: z.string(),
  scriptLines: z.array(PodcastScriptLineSchema),
  threadId: z.string(),
});

export type LoadPodcastParams = z.infer<typeof _LoadPodcastParamsSchema>;

const _LoadPlaylistParamsSchema = z.object({
  episodes: z.array(PodcastEpisodeSchema),
  threadId: z.string(),
});

export type LoadPlaylistParams = z.infer<typeof _LoadPlaylistParamsSchema>;

// ============================================================================
// DEFAULT STATE
// ============================================================================

export const defaultPodcastPlayerState: PodcastPlayerState = {
  audioError: null,
  audioUrl: null,
  currentEpisodeIndex: 0,
  currentSpeakerIndex: 0,
  currentTime: 0,
  duration: 0,
  episodes: [],
  generationProgress: null,
  generationStartedAt: null,
  generationStatus: null,
  generationThreadId: null,
  hoveredSegmentIndex: null,
  isBuffering: false,
  isExpanded: false,
  isPlaying: false,
  isPlaylist: false,
  isVisible: false,
  playbackRate: 1,
  podcastId: null,
  scriptLines: [],
  threadId: null,
  volume: 1,
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Applies episode data to the store state.
 * Reused by loadPlaylist, nextEpisode, previousEpisode, playEpisodeAtIndex.
 */
function episodeToState(episode: PodcastEpisode) {
  return {
    audioUrl: episode.audioUrl,
    currentSpeakerIndex: 0,
    currentTime: 0,
    duration: 0,
    podcastId: episode.podcastId,
    scriptLines: episode.scriptLines,
  };
}

// ============================================================================
// STORE FACTORY
// ============================================================================

export function createPodcastPlayerStore(
  initState: PodcastPlayerState = defaultPodcastPlayerState,
) {
  return createStore<PodcastPlayerStore>(
    (set, get) => ({
      ...initState,

      closePodcast: () =>
        set({
          ...defaultPodcastPlayerState,
        }, false, 'podcast/closePodcast'),

      loadPlaylist: (params: LoadPlaylistParams) => {
        if (params.episodes.length === 0) {
          return;
        }

        const firstEpisode = params.episodes[0];
        if (!firstEpisode) {
          return;
        }

        set({
          ...episodeToState(firstEpisode),
          audioError: null,
          currentEpisodeIndex: 0,
          episodes: params.episodes,
          isExpanded: false,
          isPlaying: true,
          isPlaylist: params.episodes.length > 1,
          isVisible: true,
          threadId: params.threadId,
        }, false, 'podcast/loadPlaylist');
      },

      loadPodcast: (params: LoadPodcastParams) =>
        set({
          audioUrl: params.audioUrl,
          currentEpisodeIndex: 0,
          currentSpeakerIndex: 0,
          currentTime: 0,
          duration: 0,
          episodes: [],
          isExpanded: false,
          isPlaying: false,
          isPlaylist: false,
          isVisible: true,
          podcastId: params.podcastId,
          scriptLines: params.scriptLines,
          threadId: params.threadId,
        }, false, 'podcast/loadPodcast'),

      nextEpisode: () => {
        const state = get();
        const nextIndex = state.currentEpisodeIndex + 1;
        if (nextIndex >= state.episodes.length) {
          return;
        }

        const nextEp = state.episodes[nextIndex];
        if (!nextEp) {
          return;
        }

        set({
          ...episodeToState(nextEp),
          currentEpisodeIndex: nextIndex,
          isPlaying: true,
        }, false, 'podcast/nextEpisode');
      },

      pause: () =>
        set({ isPlaying: false }, false, 'podcast/pause'),

      play: () =>
        set({ isPlaying: true }, false, 'podcast/play'),

      playEpisodeAtIndex: (index: number) => {
        const state = get();
        if (index < 0 || index >= state.episodes.length) {
          return;
        }

        const episode = state.episodes[index];
        if (!episode) {
          return;
        }

        set({
          ...episodeToState(episode),
          currentEpisodeIndex: index,
          isPlaying: true,
        }, false, 'podcast/playEpisodeAtIndex');
      },

      previousEpisode: () => {
        const state = get();
        const prevIndex = state.currentEpisodeIndex - 1;
        if (prevIndex < 0) {
          return;
        }

        const prevEp = state.episodes[prevIndex];
        if (!prevEp) {
          return;
        }

        set({
          ...episodeToState(prevEp),
          currentEpisodeIndex: prevIndex,
          isPlaying: true,
        }, false, 'podcast/previousEpisode');
      },

      seek: (time: number) =>
        set({ currentTime: time }, false, 'podcast/seek'),

      setAudioError: (error: string | null) =>
        set({ audioError: error }, false, 'podcast/setAudioError'),

      setBuffering: (buffering: boolean) =>
        set({ isBuffering: buffering }, false, 'podcast/setBuffering'),

      setGenerationProgress: (progress: GenerationProgress | null) =>
        set({ generationProgress: progress }, false, 'podcast/setGenerationProgress'),

      setGenerationStatus: (status: PodcastStatus | null, threadId: string | null) => {
        const wasGenerating = !!get().generationStatus;
        set({
          generationStartedAt: status && !wasGenerating
            ? Date.now()
            : status
              ? get().generationStartedAt
              : null,
          generationStatus: status,
          generationThreadId: threadId,
          // Auto-expand when generation starts (not already generating)
          ...(status && !wasGenerating ? { isExpanded: true } : {}),
        }, false, 'podcast/setGenerationStatus');
      },

      setHoveredSegment: (index: number | null) =>
        set({ hoveredSegmentIndex: index }, false, 'podcast/setHoveredSegment'),

      setPlaybackRate: (rate: number) =>
        set({ playbackRate: rate }, false, 'podcast/setPlaybackRate'),

      setVolume: (volume: number) =>
        set({ volume: Math.max(0, Math.min(1, volume)) }, false, 'podcast/setVolume'),

      toggleExpanded: () => {
        const state = get();
        set({ isExpanded: !state.isExpanded }, false, 'podcast/toggleExpanded');
      },

      togglePlayPause: () => {
        const state = get();
        set({ isPlaying: !state.isPlaying }, false, 'podcast/togglePlayPause');
      },

      updateCurrentSpeaker: (index: number) =>
        set({ currentSpeakerIndex: index }, false, 'podcast/updateCurrentSpeaker'),

      updateCurrentTime: (time: number) =>
        set({ currentTime: time }, false, 'podcast/updateCurrentTime'),

      updateDuration: (duration: number) =>
        set({ duration }, false, 'podcast/updateDuration'),

      updatePlaylistLive: (params: LoadPlaylistParams) => {
        const state = get();

        // If different thread or not visible, do a full load
        if (state.threadId !== params.threadId || !state.isVisible) {
          if (params.episodes.length === 0) {
            return;
          }
          const firstEpisode = params.episodes[0];
          if (!firstEpisode) {
            return;
          }
          set({
            ...episodeToState(firstEpisode),
            audioError: null,
            currentEpisodeIndex: 0,
            episodes: params.episodes,
            generationStatus: null,
            generationThreadId: null,
            isExpanded: false,
            isPlaying: true,
            isPlaylist: params.episodes.length > 1,
            isVisible: true,
            threadId: params.threadId,
          }, false, 'podcast/updatePlaylistLive');
          return;
        }

        // Same thread, already visible — merge without interrupting playback
        const currentPodcastId = state.episodes[state.currentEpisodeIndex]?.podcastId;
        const newIndex = currentPodcastId
          ? params.episodes.findIndex(ep => ep.podcastId === currentPodcastId)
          : 0;
        const resolvedIndex = newIndex >= 0 ? newIndex : 0;

        // Always preserve playback state (currentTime, duration, currentSpeakerIndex, audioUrl).
        // Only sync scriptLines and episode metadata during live updates.
        const updatedEp = params.episodes[resolvedIndex];
        const currentBaseUrl = state.audioUrl?.split('&v=')[0] ?? '';
        const newBaseUrl = updatedEp?.audioUrl?.split('&v=')[0] ?? '';
        const audioUrlChanged = currentBaseUrl !== newBaseUrl;

        const partialToComplete = !updatedEp?.isPartial && state.episodes[state.currentEpisodeIndex]?.isPartial;
        const mergeUpdate = updatedEp
          ? {
              scriptLines: updatedEp.scriptLines,
              // Update audioUrl when base URL changed OR episode just completed (partial->complete)
              ...(audioUrlChanged || partialToComplete ? { audioUrl: updatedEp.audioUrl } : {}),
            }
          : {};

        set({
          ...mergeUpdate,
          currentEpisodeIndex: resolvedIndex,
          episodes: params.episodes,
          isPlaylist: params.episodes.length > 1,
        }, false, 'podcast/updatePlaylistLive');
      },
    }),
  );
}

// ============================================================================
// STORE API TYPE
// ============================================================================

export type PodcastPlayerStoreApi = ReturnType<typeof createPodcastPlayerStore>;

// ============================================================================
// SINGLETON INSTANCE + HOOK
// ============================================================================

/**
 * Global singleton podcast player store instance.
 * Podcast playback state is app-wide (only one podcast plays at a time).
 */
const podcastPlayerStore = createPodcastPlayerStore();

/**
 * Hook to access the global podcast player store with selector optimization.
 * Usage: `const { isPlaying, play } = usePodcastStore(s => ({ isPlaying: s.isPlaying, play: s.play }))`
 */
export function usePodcastStore<T>(selector: (state: PodcastPlayerStore) => T): T {
  return useStore(podcastPlayerStore, selector);
}
