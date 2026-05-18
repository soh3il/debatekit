/**
 * Podcast Audio Player Hook
 *
 * Manages HTML5 Audio element lifecycle and syncs with Zustand store.
 * Tracks current speaker from scriptLines timestamps.
 * Auto-advances to next episode in playlist mode when audio ends.
 *
 * Usage:
 *   const { isReady, pause, play, seek } = usePodcastPlayer();
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AnalyticsEvents, useAnalytics } from '@/lib/analytics';
import { useShallow } from '@/lib/store';
import { usePodcastStore } from '@/stores/podcast/store';

/**
 * Manages HTML5 Audio element, syncs play/pause/time with store.
 * Tracks current speaker from scriptLines timestamps.
 * Auto-advances to next episode when audio ends in playlist mode.
 */
export function usePodcastPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const lastPlaybackTimeRef = useRef(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partialRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { track } = useAnalytics();

  const {
    audioUrl,
    currentEpisodeIndex,
    episodes,
    isBuffering,
    isPlaying,
    isPlaylist,
    playbackRate,
    volume,
  } = usePodcastStore(
    useShallow(s => ({
      audioUrl: s.audioUrl,
      currentEpisodeIndex: s.currentEpisodeIndex,
      episodes: s.episodes,
      isBuffering: s.isBuffering,
      isPlaying: s.isPlaying,
      isPlaylist: s.isPlaylist,
      playbackRate: s.playbackRate,
      volume: s.volume,
    })),
  );

  // Refs for values used inside the main Audio effect — prevents Audio element
  // recreation when polls replace the episodes array or volume changes.
  const episodesRef = useRef(episodes);
  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);
  const isPlaylistRef = useRef(isPlaylist);
  const volumeRef = useRef(volume);
  episodesRef.current = episodes;
  currentEpisodeIndexRef.current = currentEpisodeIndex;
  isPlaylistRef.current = isPlaylist;
  volumeRef.current = volume;

  const scriptLines = usePodcastStore(s => s.scriptLines);

  // Precompute speaker timing boundaries for accurate tracking.
  // Uses backend startMs/endMs when available, falls back to character-proportional estimation.
  const hasBackendTiming = scriptLines.length > 0 && scriptLines[0]?.startMs !== undefined;

  const speakerTimingMs = useMemo(() => {
    if (scriptLines.length === 0) {
      return [];
    }

    if (hasBackendTiming) {
      return scriptLines.map(l => ({
        endMs: l.endMs ?? 0,
        startMs: l.startMs ?? 0,
      }));
    }

    // Fallback: character-proportional estimation (used when no timing data)
    // Strip audio tags like [laughs], [sighs] from character counts since they take minimal audio time
    const effectiveLengths = scriptLines.map(l => l.text.replace(/\[[^\]]*\]/g, '').trim().length || 1);
    const totalChars = effectiveLengths.reduce((sum, len) => sum + len, 0);
    if (totalChars === 0) {
      return [];
    }
    let currentRatio = 0;
    return scriptLines.map((_l, i) => {
      const startRatio = currentRatio;
      currentRatio += (effectiveLengths[i] ?? 1) / totalChars;
      return { endMs: currentRatio, startMs: startRatio };
    });
  }, [scriptLines, hasBackendTiming]);

  // Refs so the main Audio effect can read speaker timing without re-creating
  // the Audio element when poll ticks update scriptLines.
  const speakerTimingMsRef = useRef(speakerTimingMs);
  const hasBackendTimingRef = useRef(hasBackendTiming);
  speakerTimingMsRef.current = speakerTimingMs;
  hasBackendTimingRef.current = hasBackendTiming;

  const updateCurrentSpeaker = usePodcastStore(s => s.updateCurrentSpeaker);
  const updateCurrentTime = usePodcastStore(s => s.updateCurrentTime);
  const updateDuration = usePodcastStore(s => s.updateDuration);
  const pause = usePodcastStore(s => s.pause);
  const playAction = usePodcastStore(s => s.play);
  const setAudioError = usePodcastStore(s => s.setAudioError);
  const setBuffering = usePodcastStore(s => s.setBuffering);
  const setPlaybackRateAction = usePodcastStore(s => s.setPlaybackRate);
  const setVolumeAction = usePodcastStore(s => s.setVolume);
  const togglePlayPauseAction = usePodcastStore(s => s.togglePlayPause);
  const nextEpisode = usePodcastStore(s => s.nextEpisode);

  // Create/replace Audio element when audioUrl changes
  useEffect(() => {
    if (!audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setIsReady(false);
      return;
    }

    setAudioError(null);
    retryCountRef.current = 0;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setIsReady(false);

    const handleCanPlay = () => {
      setIsReady(true);
      // Fallback: also set duration on canplay if loadedmetadata hasn't fired yet
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        updateDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      updateCurrentTime(audio.currentTime);

      const timingMs = speakerTimingMsRef.current;
      const useBackendTiming = hasBackendTimingRef.current;

      // Track current speaker using timing boundaries
      if (audio.duration > 0 && timingMs.length > 0) {
        if (useBackendTiming) {
          // Use precise backend timestamps (ms)
          // Conservative: find last line whose startMs <= currentMs (stays on current speaker until next clearly starts)
          const currentMs = audio.currentTime * 1000;
          let idx = 0;
          for (let i = 0; i < timingMs.length; i++) {
            const timing = timingMs[i];
            if (timing && currentMs >= timing.startMs) {
              idx = i;
            }
            if (timing && timing.startMs > currentMs) {
              break;
            }
          }
          updateCurrentSpeaker(idx);
        } else {
          // Fallback: character-proportional (0-1 ratios scaled by duration)
          // Conservative: find last line whose start ratio <= progress
          const progress = audio.currentTime / audio.duration;
          let idx = 0;
          for (let i = 0; i < timingMs.length; i++) {
            const timing = timingMs[i];
            if (timing && progress >= timing.startMs) {
              idx = i;
            }
            if (timing && timing.startMs > progress) {
              break;
            }
          }
          updateCurrentSpeaker(idx);
        }
      }

      // Smooth volume fade-out over last 2 seconds before episode ends
      // Only fade when auto-advancing to prevent abrupt audio cuts
      const currentEp = episodesRef.current[currentEpisodeIndexRef.current];
      const hasNext = isPlaylistRef.current && currentEpisodeIndexRef.current < episodesRef.current.length - 1;
      if (
        hasNext
        && !currentEp?.isPartial
        && audio.duration > 0
        && audio.duration - audio.currentTime < 2
      ) {
        const remainingRatio = (audio.duration - audio.currentTime) / 2;
        audio.volume = Math.max(0, volumeRef.current * remainingRatio);
      } else {
        audio.volume = volumeRef.current;
      }
    };

    const handleEnded = () => {
      // Check if current episode is partial (still generating) — retry after delay
      const currentEp = episodesRef.current[currentEpisodeIndexRef.current];
      if (currentEp?.isPartial) {
        const currentTime = audio.currentTime;
        lastPlaybackTimeRef.current = currentTime;
        setBuffering(true);

        // Clear any existing partial retry timer
        if (partialRetryTimerRef.current) {
          clearTimeout(partialRetryTimerRef.current);
        }

        // Auto-retry after 5s — reload with cache-bust so browser fetches updated audio from R2
        partialRetryTimerRef.current = setTimeout(() => {
          partialRetryTimerRef.current = null;
          if (!audioRef.current) {
            return;
          }
          // Strip any existing cache-bust param and add a fresh one
          const baseUrl = currentEp.audioUrl.split('&v=')[0];
          audioRef.current.src = `${baseUrl}&v=${Date.now()}`;
          audioRef.current.load();

          const handleCanPlayAfterRetry = () => {
            if (!audioRef.current) {
              return;
            }
            // Clamp restored time to actual duration, rewind 1s to avoid gap
            const seekTo = Math.min(
              Math.max(0, currentTime - 1),
              Math.max(0, audioRef.current.duration - 0.5),
            );
            if (seekTo > 0) {
              audioRef.current.currentTime = seekTo;
            }
            setBuffering(false);
            audioRef.current.play().catch(() => pause());
            audioRef.current.removeEventListener('canplay', handleCanPlayAfterRetry);
          };

          audioRef.current.addEventListener('canplay', handleCanPlayAfterRetry);
        }, 5000);

        return; // Don't advance to next episode
      }

      track(AnalyticsEvents.PODCAST_COMPLETED, {
        duration: audio.duration,
        episode_index: currentEpisodeIndexRef.current,
        is_playlist: isPlaylistRef.current,
      });

      // In playlist mode, auto-advance to next episode with a brief pause
      const hasNextEpisode = isPlaylistRef.current && currentEpisodeIndexRef.current < episodesRef.current.length - 1;
      if (hasNextEpisode) {
        // Restore volume before transitioning so next episode starts at full volume
        audio.volume = volumeRef.current;
        setBuffering(true);

        // Brief pause between episodes for natural transition
        if (transitionTimerRef.current) {
          clearTimeout(transitionTimerRef.current);
        }
        transitionTimerRef.current = setTimeout(() => {
          transitionTimerRef.current = null;
          nextEpisode();
          setBuffering(false);
        }, 1500);
      } else {
        pause();
      }
    };

    const handleError = () => {
      if (retryCountRef.current < 3) {
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.load();
          }
        }, 1000 * retryCountRef.current);
      } else {
        setAudioError('Failed to load audio');
        setIsReady(false);
        pause();
      }
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        updateDuration(audio.duration);
      }
    };

    // Track buffering via waiting/playing events for partial episode UX
    const handleWaiting = () => {
      setBuffering(true);
    };

    const handlePlaying = () => {
      setBuffering(false);
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      setIsReady(false);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (partialRetryTimerRef.current) {
        clearTimeout(partialRetryTimerRef.current);
        partialRetryTimerRef.current = null;
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, [audioUrl, nextEpisode, pause, setAudioError, setBuffering, track, updateCurrentSpeaker, updateCurrentTime, updateDuration]);

  // Sync play/pause state with Audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isReady) {
      return;
    }

    if (isPlaying) {
      audio.play().catch(() => {
        // Autoplay blocked by browser - update store to reflect paused state
        pause();
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, isReady, pause]);

  // Sync volume
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = volume;
  }, [volume]);

  // Sync playback rate
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  // Buffering recovery — when isBuffering and episodes array changes (new audio arrived),
  // reload Audio element with cache-busted URL, seek to saved position, resume playback
  useEffect(() => {
    if (!isBuffering) {
      return;
    }

    const currentEp = episodesRef.current[currentEpisodeIndexRef.current];
    if (!currentEp) {
      return;
    }

    // If episode is no longer partial (completed) or URL changed, recover
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    // Check if the URL has been updated (cache-busted with new audioSizeBytes)
    if (audio.src.includes(currentEp.audioUrl) || currentEp.audioUrl === audioUrl) {
      return; // Same URL, still waiting for new data
    }

    // New audio data available — reload and seek
    const savedTime = lastPlaybackTimeRef.current;
    audio.src = currentEp.audioUrl;
    audio.load();

    const handleCanPlayAfterBuffer = () => {
      if (savedTime > 0) {
        // Clamp restored time to actual duration to avoid seeking past the end
        const clampedTime = Number.isFinite(audio.duration) && savedTime > audio.duration
          ? Math.max(0, audio.duration - 2)
          : savedTime;
        audio.currentTime = clampedTime;
      }
      setBuffering(false);
      audio.play().catch(() => pause());
      audio.removeEventListener('canplay', handleCanPlayAfterBuffer);
    };

    audio.addEventListener('canplay', handleCanPlayAfterBuffer);
  }, [audioUrl, isBuffering, pause, setBuffering]);

  const play = useCallback(() => {
    playAction();
  }, [playAction]);

  const pauseCallback = useCallback(() => {
    pause();
  }, [pause]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = time;
    updateCurrentTime(time);
  }, [updateCurrentTime]);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateAction(rate);
  }, [setPlaybackRateAction]);

  const setVolume = useCallback((vol: number) => {
    setVolumeAction(vol);
  }, [setVolumeAction]);

  const togglePlayPause = useCallback(() => {
    togglePlayPauseAction();
  }, [togglePlayPauseAction]);

  return {
    isReady,
    pause: pauseCallback,
    play,
    seek,
    setPlaybackRate,
    setVolume,
    togglePlayPause,
  };
}
