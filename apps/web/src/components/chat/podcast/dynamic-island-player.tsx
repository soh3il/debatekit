'use client';

import { PodcastStatuses } from '@debatekit/shared/enums';
import { useLocation } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LazyPersona } from '@/components/ai-elements/lazy-persona';
import { TextShimmer } from '@/components/ai-elements/shimmer';
import { Icons } from '@/components/icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BRAND } from '@/constants/brand';
import { useIsMobile, usePodcastPlayer, useWaveformSegments } from '@/hooks/utils';
import { AnalyticsEvents, DiscoverableFeatures, useAnalytics } from '@/lib/analytics';
import { downloadEpisode } from '@/lib/audio/download-episode';
import { useTranslations } from '@/lib/i18n';
import { useShallow } from '@/lib/store';
import { cn } from '@/lib/ui/cn';
import { usePodcastStore } from '@/stores/podcast/store';

import { buildSpeakerColorMap } from './speaker-colors';
import { SpeakerIndicator } from './speaker-indicator';
import { WaveformTimeline } from './waveform-timeline';

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const;

/** Estimate time remaining based on progress rate */
function estimateTimeRemaining(startedAt: number | null, progress: number): string | null {
  if (!startedAt || progress <= 10) {
    return null;
  }
  const elapsed = Date.now() - startedAt;
  const normalizedProgress = progress - 10; // subtract base 10% offset
  if (normalizedProgress <= 0) {
    return null;
  }
  const rate = normalizedProgress / elapsed;
  const remaining = (90 - normalizedProgress) / rate;
  if (remaining < 5000) {
    return 'Almost done';
  }
  if (remaining < 60_000) {
    return `~${Math.ceil(remaining / 1000)}s left`;
  }
  return `~${Math.ceil(remaining / 60_000)}min left`;
}

/** Get a phase-specific status message based on podcast generation status */
function getGenerationStatusMessage(status: string | null): string {
  switch (status) {
    case 'pending': return 'Starting up...';
    case 'generating_script': return 'Writing script...';
    case 'generating_audio': return 'Generating audio...';
    case 'uploading': return 'Finalizing...';
    case 'failed': return 'Generation failed';
    default: return 'Generating...';
  }
}

// ============================================================================
// COMPACT — generating state (shimmering + blended progress)
// ============================================================================

function CompactGeneratingContent({ status }: { status: string }) {
  const t = useTranslations('podcast');
  const generationProgress = usePodcastStore(s => s.generationProgress);
  const generationStartedAt = usePodcastStore(s => s.generationStartedAt);

  const activeEpisode = generationProgress?.episodes.find(
    ep => ep.status !== PodcastStatuses.COMPLETED && ep.status !== PodcastStatuses.FAILED,
  );
  const failedCount = generationProgress?.episodes.filter(ep => ep.status === PodcastStatuses.FAILED).length ?? 0;
  const allFailed = generationProgress && failedCount === generationProgress.total;

  const statusText = allFailed
    ? t('podcastFailed')
    : activeEpisode?.episodeTitle
      ? activeEpisode.episodeTitle
      : status === PodcastStatuses.GENERATING_SCRIPT
        ? t('generatingScript')
        : status === PodcastStatuses.GENERATING_AUDIO
          ? t('generatingAudio')
          : t('preparingPodcast');

  const progressText = generationProgress
    ? `${generationProgress.completed}/${generationProgress.total}`
    : null;

  const rawProgress = generationProgress && generationProgress.total > 0
    ? Math.round(
        generationProgress.episodes.reduce((sum, ep) => {
          const segment = 100 / generationProgress.total;
          if (ep.status === PodcastStatuses.COMPLETED) {
            return sum + segment;
          }
          if (ep.status === PodcastStatuses.FAILED) {
            return sum;
          }
          return sum + (segment * ep.progress / 100);
        }, 0),
      )
    : 0;

  // Estimated progress fallback: smoothly advance when real progress is stalled.
  // Ticks ~1% every 3s, capped at 85% so real progress always catches up.
  const [estimatedProgress, setEstimatedProgress] = useState(0);
  const estimatedRef = useRef(0);
  const isStalled = rawProgress <= 10 && (status === PodcastStatuses.GENERATING_AUDIO || status === PodcastStatuses.GENERATING_SCRIPT);

  useEffect(() => {
    if (!isStalled) {
      // Real progress arrived — reset estimate
      estimatedRef.current = 0;
      setEstimatedProgress(0);
      return;
    }

    const timer = setInterval(() => {
      estimatedRef.current = Math.min(estimatedRef.current + 1, 85);
      setEstimatedProgress(estimatedRef.current);
    }, 3000);

    return () => clearInterval(timer);
  }, [isStalled]);

  const overallProgress = Math.max(rawProgress, isStalled ? estimatedProgress : 0);

  return (
    <div className={cn('flex items-center gap-2.5 pl-3.5 h-12 w-full relative overflow-hidden', 'pr-9')}>
      <div className="relative shrink-0">
        <LazyPersona
          className={cn(
            'size-6',
            allFailed ? 'opacity-50' : '',
          )}
          state={allFailed ? 'asleep' : 'thinking'}
        />
      </div>

      {/* Status text — shimmering when generating */}
      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        {allFailed
          ? (
              <span className="text-[13px] font-medium text-red-400/80 truncate">
                {statusText}
              </span>
            )
          : (
              <TextShimmer className="text-[13px] font-medium text-foreground/80 truncate">
                {statusText}
              </TextShimmer>
            )}
        {/* Phase-specific sub-status with ETA */}
        {!allFailed && (
          <span className="text-[10px] text-white/30 truncate">
            {getGenerationStatusMessage(status)}
            {(() => {
              const eta = estimateTimeRemaining(generationStartedAt, overallProgress);
              return eta ? <span className="ml-1 opacity-70">{eta}</span> : null;
            })()}
          </span>
        )}
      </div>

      {progressText && (
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded-full shrink-0 tabular-nums',
          allFailed ? 'text-red-400/50 bg-red-400/[0.08]' : 'text-white/35 bg-white/[0.06]',
        )}
        >
          {progressText}
        </span>
      )}

      {/* Blended progress bar — flush with bottom, respects parent overflow:hidden + rounded corners */}
      {!allFailed && (overallProgress > 0 || status === PodcastStatuses.GENERATING_AUDIO) && (
        <div className="absolute bottom-0 inset-x-0 h-[3px]">
          {/* Track */}
          <div className="absolute inset-0 bg-white/[0.04]" />
          {overallProgress <= 10 && (status === PodcastStatuses.GENERATING_AUDIO || status === PodcastStatuses.GENERATING_SCRIPT)
            ? (
                /* Indeterminate shimmer — waiting for audio service to start streaming */
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-y-0 w-[30%] animate-[shimmer-sweep_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
              )
            : (
                <>
                  {/* Fill with gradient glow */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-r-full transition-all duration-700 ease-out"
                    style={{
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.25))',
                      width: `${overallProgress}%`,
                    }}
                  />
                  {/* Shimmer sweep over the fill */}
                  <div
                    className="absolute inset-y-0 left-0 overflow-hidden"
                    style={{ width: `${overallProgress}%` }}
                  >
                    <div className="absolute inset-y-0 w-[60%] animate-[shimmer-sweep_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>
                </>
              )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPACT — playing state (with speaker indicator)
// ============================================================================

function CompactContent({ isExpanded, togglePlayPause }: { isExpanded: boolean; togglePlayPause: () => void }) {
  const t = useTranslations('podcast');
  const { trackFeatureUsage } = useAnalytics();
  const { audioError, currentEpisodeIndex, currentSpeakerIndex, currentTime, duration, episodes, isBuffering, isPlaying, isPlaylist, scriptLines } = usePodcastStore(
    useShallow(s => ({
      audioError: s.audioError,
      currentEpisodeIndex: s.currentEpisodeIndex,
      currentSpeakerIndex: s.currentSpeakerIndex,
      currentTime: s.currentTime,
      duration: s.duration,
      episodes: s.episodes,
      isBuffering: s.isBuffering,
      isPlaying: s.isPlaying,
      isPlaylist: s.isPlaylist,
      scriptLines: s.scriptLines,
    })),
  );
  const currentSpeaker = scriptLines[currentSpeakerIndex];
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const speakerColorMap = useMemo(
    () => buildSpeakerColorMap(scriptLines),
    [scriptLines],
  );
  const speakerColor = currentSpeaker
    ? speakerColorMap.get(currentSpeaker.speakerId)
    : undefined;

  return (
    <div className={cn('flex items-center gap-2.5 pl-3.5 h-12 w-full relative overflow-hidden', 'pr-9')}>
      <LazyPersona
        className="size-6 shrink-0"
        state={isPlaying ? 'speaking' : 'idle'}
      />

      {/* Speaker indicator with provider icon + colored dot */}
      <div className="flex-1 min-w-0">
        <SpeakerIndicator
          speakerName={currentSpeaker?.speakerName ?? t('narrator')}
          color={speakerColor}
        />
      </div>

      {audioError && (
        <span className="text-[10px] text-red-400/70 bg-red-400/[0.08] px-1.5 py-0.5 rounded-full shrink-0">
          Error
        </span>
      )}

      {isPlaylist && (
        <span className="text-[10px] text-white/35 bg-white/[0.06] px-1.5 py-0.5 rounded-full shrink-0 tabular-nums">
          Ep
          {' '}
          {currentEpisodeIndex + 1}
          /
          {episodes.length}
        </span>
      )}

      {/* Hide play button + timestamp when expanded — expanded content has its own controls */}
      {!isExpanded && (
        <>
          {isBuffering
            ? (
                <div className="size-7 flex items-center justify-center rounded-full bg-white/20 shrink-0">
                  <Icons.loader className="size-3 text-white/60 animate-spin" />
                </div>
              )
            : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    trackFeatureUsage(
                      isPlaying ? AnalyticsEvents.PODCAST_PAUSED : AnalyticsEvents.PODCAST_PLAYED,
                      DiscoverableFeatures.PODCAST_PLAYBACK,
                      { current_time: currentTime, duration },
                    );
                    togglePlayPause();
                  }}
                  className="size-7 flex items-center justify-center rounded-full bg-white text-black shrink-0 active:scale-90 transition-transform"
                >
                  {isPlaying
                    ? <Icons.pause className="size-3" />
                    : <Icons.play className="size-3 ml-px" />}
                </button>
              )}

          <span className="text-[10px] text-white/40 tabular-nums shrink-0">
            {isBuffering ? t('buffering') : formatTime(currentTime)}
          </span>
        </>
      )}

      {/* Playback progress — blended into bottom edge */}
      <div className="absolute bottom-0 inset-x-0 h-[3px]">
        <div className="absolute inset-0 bg-white/[0.04]" />
        <div
          className="absolute inset-y-0 left-0 bg-white/25 rounded-r-full transition-[width] duration-300 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// EPISODE LIST — shared between expanded content states
// ============================================================================

function EpisodeList() {
  const t = useTranslations('podcast');
  const { currentEpisodeIndex, episodes } = usePodcastStore(
    useShallow(s => ({
      currentEpisodeIndex: s.currentEpisodeIndex,
      episodes: s.episodes,
    })),
  );
  const playEpisodeAtIndex = usePodcastStore(s => s.playEpisodeAtIndex);
  const generationProgress = usePodcastStore(s => s.generationProgress);

  // Exclude episodes already shown in the playable list to avoid duplicates
  const playableRounds = new Set(episodes.map(ep => ep.roundNumber));
  const generatingEps = generationProgress?.episodes.filter(
    ep => ep.status !== PodcastStatuses.COMPLETED && !playableRounds.has(ep.roundNumber ?? undefined),
  ) ?? [];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-medium text-white/35 uppercase tracking-wider">
        {t('episodes')}
      </p>
      <ScrollArea className="max-h-[180px]">
        <div className="flex flex-col gap-0.5">
          {episodes.map((episode, idx) => {
            const isActive = idx === currentEpisodeIndex;
            return (
              <button
                key={episode.podcastId}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isActive && !episode.isPartial) {
                    playEpisodeAtIndex(idx);
                  }
                }}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
                  isActive ? 'bg-white/[0.08]' : episode.isPartial ? 'cursor-not-allowed opacity-60' : 'hover:bg-white/[0.04]',
                )}
              >
                <span className={cn(
                  'size-5 flex items-center justify-center rounded-full text-[10px] font-medium shrink-0',
                  isActive ? 'bg-white/20 text-white/90' : 'bg-white/[0.06] text-white/35',
                )}
                >
                  {idx + 1}
                </span>
                <span className={cn(
                  'text-[12px] font-medium truncate flex-1',
                  isActive ? 'text-white/90' : 'text-white/50',
                )}
                >
                  {episode.title || t('episodeRoundLabel', { round: episode.roundNumber ?? idx + 1 })}
                </span>
                {isActive && !episode.isPartial && (
                  <span className="text-[9px] text-white/35 bg-white/[0.06] px-1.5 py-0.5 rounded-full shrink-0">
                    {t('nowPlaying')}
                  </span>
                )}
                {episode.isPartial && (() => {
                  const epProgress = generationProgress?.episodes.find(
                    ep => ep.roundNumber === episode.roundNumber,
                  );
                  const pct = epProgress?.progress ?? 0;
                  return (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-10 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400/40 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-amber-400/60 tabular-nums">
                        {pct}
                        %
                      </span>
                    </div>
                  );
                })()}
                {!episode.isPartial && !isActive && (
                  <Icons.check className="size-3 text-white/20 shrink-0" />
                )}
              </button>
            );
          })}

          {generatingEps.map((ep, idx) => {
            const isFailed = ep.status === PodcastStatuses.FAILED;
            return (
              <div
                key={`gen-${ep.roundNumber ?? idx}`}
                className={cn(
                  'flex flex-col gap-1 px-2.5 py-2 rounded-lg',
                  isFailed ? 'opacity-80' : 'opacity-50',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    'size-5 flex items-center justify-center rounded-full text-[10px] font-medium shrink-0',
                    isFailed ? 'bg-red-400/10 text-red-400/50' : 'bg-white/[0.06] text-white/25',
                  )}
                  >
                    {isFailed
                      ? <Icons.x className="size-2.5" />
                      : episodes.length + idx + 1}
                  </span>
                  <span className={cn(
                    'text-[12px] font-medium truncate flex-1',
                    isFailed ? 'text-red-400/50' : 'text-white/35',
                  )}
                  >
                    {ep.episodeTitle ?? t('episodeRoundLabel', { round: ep.roundNumber ?? episodes.length + idx + 1 })}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isFailed && ep.progress > 0 && ep.progress < 100 && (
                      <div className="w-16 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white/25 rounded-full transition-all duration-500"
                          style={{ width: `${ep.progress}%` }}
                        />
                      </div>
                    )}
                    <span className={cn(
                      'text-[9px] tabular-nums',
                      isFailed ? 'text-red-400/40' : 'text-white/25',
                    )}
                    >
                      {isFailed
                        ? t('podcastFailed')
                        : ep.progress > 0 ? `${ep.progress}%` : t('queued')}
                    </span>
                  </div>
                </div>
                {isFailed && ep.errorMessage && (
                  <p className="text-[10px] text-red-400/40 pl-[30px] leading-relaxed line-clamp-2">
                    {ep.errorMessage}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// EXPANDED — generating state
// ============================================================================

function ExpandedGeneratingContent() {
  const generationProgress = usePodcastStore(s => s.generationProgress);

  if (!generationProgress || generationProgress.episodes.length === 0) {
    return null;
  }

  return (
    <div className="px-4 pt-3 pb-4 w-full">
      <EpisodeList />
    </div>
  );
}

// ============================================================================
// EXPANDED — playing state (with waveform timeline)
// ============================================================================

function ExpandedContent({ seek, setPlaybackRate, togglePlayPause }: {
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  togglePlayPause: () => void;
}) {
  const t = useTranslations('podcast');
  const { track } = useAnalytics();
  const {
    audioUrl,
    currentEpisodeIndex,
    currentTime,
    duration,
    episodes,
    isBuffering,
    isPlaying,
    isPlaylist,
    playbackRate,
    scriptLines,
  } = usePodcastStore(
    useShallow(s => ({
      audioUrl: s.audioUrl,
      currentEpisodeIndex: s.currentEpisodeIndex,
      currentTime: s.currentTime,
      duration: s.duration,
      episodes: s.episodes,
      isBuffering: s.isBuffering,
      isPlaying: s.isPlaying,
      isPlaylist: s.isPlaylist,
      playbackRate: s.playbackRate,
      scriptLines: s.scriptLines,
    })),
  );

  const nextEpisode = usePodcastStore(s => s.nextEpisode);
  const previousEpisode = usePodcastStore(s => s.previousEpisode);
  const [isDownloading, setIsDownloading] = useState(false);

  const currentEpisode = episodes[currentEpisodeIndex];
  const episodeTitle = currentEpisode?.title || '';
  const episodeNumber = currentEpisode
    ? currentEpisodeIndex + 1
    : undefined;

  const handleDownload = useCallback(async () => {
    if (!audioUrl || isDownloading) {
      return;
    }
    setIsDownloading(true);
    try {
      await downloadEpisode({
        audioUrl,
        episodeNumber,
        title: episodeTitle,
      });
      track(AnalyticsEvents.PODCAST_DOWNLOADED, {
        episode_number: episodeNumber,
        title: episodeTitle,
      });
    } catch {
      // Fallback: direct download without tags
      const anchor = document.createElement('a');
      anchor.href = audioUrl;
      anchor.download = `${BRAND.name} - ${episodeTitle || 'Episode'}.mp3`;
      anchor.click();
    } finally {
      setIsDownloading(false);
    }
  }, [audioUrl, episodeNumber, episodeTitle, isDownloading, track]);

  const canSkipBack = currentEpisodeIndex > 0;
  const canSkipForward = currentEpisodeIndex < episodes.length - 1;

  const speakerColorMap = useMemo(
    () => buildSpeakerColorMap(scriptLines),
    [scriptLines],
  );
  const segments = useWaveformSegments(scriptLines, duration * 1000, speakerColorMap);

  return (
    <div className="flex flex-col gap-2 px-4 pt-3 pb-4 w-full">
      {/* Waveform timeline — the primary seekable control */}
      {segments.length > 0 && (
        <WaveformTimeline
          currentTime={currentTime}
          duration={duration}
          onSeek={seek}
          segments={segments}
        />
      )}

      {/* Compact control row: skip/play/skip + time + speed + download */}
      <div className="flex items-center gap-1.5">
        {isPlaylist && (
          <button
            type="button"
            disabled={!canSkipBack}
            onClick={(e) => {
              e.stopPropagation();
              previousEpisode();
            }}
            className={cn(
              'size-7 flex items-center justify-center rounded-full shrink-0 active:scale-90 transition-transform',
              canSkipBack ? 'text-white/60 hover:text-white/80' : 'text-white/15',
            )}
          >
            <Icons.skipBack className="size-3" />
          </button>
        )}

        {isBuffering
          ? (
              <div className="size-8 flex items-center justify-center rounded-full bg-white/20 shrink-0">
                <Icons.loader className="size-3.5 text-white/60 animate-spin" />
              </div>
            )
          : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  track(
                    isPlaying ? AnalyticsEvents.PODCAST_PAUSED : AnalyticsEvents.PODCAST_PLAYED,
                    { current_time: currentTime, duration },
                  );
                  togglePlayPause();
                }}
                className="size-8 flex items-center justify-center rounded-full bg-white text-black shrink-0 active:scale-90 transition-transform"
              >
                {isPlaying
                  ? <Icons.pause className="size-3.5" />
                  : <Icons.play className="size-3.5 ml-px" />}
              </button>
            )}

        {isPlaylist && (
          <button
            type="button"
            disabled={!canSkipForward}
            onClick={(e) => {
              e.stopPropagation();
              nextEpisode();
            }}
            className={cn(
              'size-7 flex items-center justify-center rounded-full shrink-0 active:scale-90 transition-transform',
              canSkipForward ? 'text-white/60 hover:text-white/80' : 'text-white/15',
            )}
          >
            <Icons.skipForward className="size-3" />
          </button>
        )}

        <span className="text-[10px] text-white/35 tabular-nums shrink-0 ml-1">
          {formatTime(currentTime)}
          {' / '}
          {formatTime(duration)}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Speed pills */}
        <div className="flex items-center gap-0.5">
          {SPEED_OPTIONS.map(speed => (
            <button
              key={speed}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                track(AnalyticsEvents.PODCAST_PLAYBACK_RATE_CHANGED, {
                  previous_rate: playbackRate,
                  rate: speed,
                });
                setPlaybackRate(speed);
              }}
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-colors active:scale-90',
                playbackRate === speed
                  ? 'bg-white/10 text-white/80'
                  : 'text-white/25 hover:text-white/45',
              )}
            >
              {speed}
              x
            </button>
          ))}
        </div>

        {audioUrl && (
          <button
            type="button"
            disabled={isDownloading}
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className={cn(
              'size-7 flex items-center justify-center rounded-full transition-colors shrink-0',
              isDownloading
                ? 'text-white/15'
                : 'text-white/25 hover:text-white/50 hover:bg-white/[0.06]',
            )}
            title={t('download')}
          >
            {isDownloading
              ? <Icons.loader className="size-3 animate-spin" />
              : <Icons.download className="size-3" />}
          </button>
        )}
      </div>

      {/* Episode list */}
      {episodes.length > 0 && (
        <>
          <div className="h-px bg-white/[0.06]" />
          <EpisodeList />
        </>
      )}
    </div>
  );
}

// ============================================================================
// MAIN
// ============================================================================

export function ThreadModeratorPlayer() {
  return <ThreadModeratorPlayerInner />;
}

function ThreadModeratorPlayerInner() {
  const { episodes, generationStatus, isExpanded, isVisible } = usePodcastStore(
    useShallow(s => ({
      episodes: s.episodes,
      generationStatus: s.generationStatus,
      isExpanded: s.isExpanded,
      isVisible: s.isVisible,
    })),
  );

  const toggleExpanded = usePodcastStore(s => s.toggleExpanded);
  const closePodcast = usePodcastStore(s => s.closePodcast);
  const { seek, setPlaybackRate, togglePlayPause } = usePodcastPlayer();

  const isMobile = useIsMobile(640);

  // Close player when navigating away (any pathname change)
  const { pathname } = useLocation();
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      closePodcast();
    }
  }, [pathname, closePodcast]);

  const isFailed = generationStatus === PodcastStatuses.FAILED;
  const isGenerating = !!generationStatus && generationStatus !== PodcastStatuses.COMPLETED && generationStatus !== PodcastStatuses.FAILED;
  // Audio is loaded and ready — show player controls instead of generating shimmer
  const hasLoadedAudio = episodes.length > 0 && isVisible;
  const shouldShow = isVisible || isGenerating || isFailed;

  if (!shouldShow) {
    return null;
  }

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={toggleExpanded}
      className={cn(
        'fixed top-[3.5rem] sm:top-[4.5rem] z-[45]',
        'inset-x-3 sm:inset-x-0 sm:right-0 sm:mx-auto',
        'w-[calc(100%-1.5rem)] sm:w-[380px]',
        // Glass styling
        'backdrop-blur-xl bg-background/15 border border-white/20 shadow-lg',
        'rounded-2xl select-none overflow-hidden',
        !isExpanded && 'hover:bg-background/20 hover:border-white/30',
        isExpanded && 'bg-background/20',
      )}
      style={{
        left: isMobile ? undefined : 'var(--sidebar-width-current, 0px)',
      }}
    >
      {/* Compact trigger bar */}
      <div className="relative">
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full cursor-pointer">
            {(isGenerating || isFailed) && !hasLoadedAudio
              ? <CompactGeneratingContent status={generationStatus} />
              : <CompactContent isExpanded={isExpanded} togglePlayPause={togglePlayPause} />}
          </button>
        </CollapsibleTrigger>

        {/* Close button - overlaid on right side */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            closePodcast();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-full text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors z-10"
        >
          <Icons.x className="size-3" />
        </button>
      </div>

      {/* Collapsible expanded content */}
      <CollapsibleContent>
        <div className="border-t border-white/[0.06]">
          {(isGenerating || isFailed) && !hasLoadedAudio
            ? <ExpandedGeneratingContent />
            : <ExpandedContent seek={seek} setPlaybackRate={setPlaybackRate} togglePlayPause={togglePlayPause} />}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
