'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { WaveformSegment } from '@/hooks/utils/use-waveform-segments';
import { cn } from '@/lib/ui/cn';
import { usePodcastStore } from '@/stores/podcast/store';

import { getSpeakerProviderIcon } from './speaker-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const BAR_COUNT = 120;
const BAR_GAP = 1.5;
const WAVEFORM_HEIGHT = 48;

type WaveformTimelineProps = {
  className?: string;
  currentTime: number; // seconds
  duration: number; // seconds
  onSeek: (timeSeconds: number) => void;
  segments: WaveformSegment[];
};

// ============================================================================
// BAR DATA — computed once per segment set
// ============================================================================

type BarData = {
  color: string;
  height: number; // 0-1
  segmentIndex: number;
  x: number;
};

function computeBars(segments: WaveformSegment[], totalWidth: number): BarData[] {
  if (segments.length === 0) {
    return [];
  }

  const totalDurationMs = segments[segments.length - 1]?.endMs ?? 0;
  if (totalDurationMs <= 0) {
    return [];
  }

  const barWidth = (totalWidth - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
  const bars: BarData[] = [];

  for (let i = 0; i < BAR_COUNT; i++) {
    const barStartMs = (i / BAR_COUNT) * totalDurationMs;
    const barEndMs = ((i + 1) / BAR_COUNT) * totalDurationMs;
    const barMidMs = (barStartMs + barEndMs) / 2;

    // Find the segment this bar falls into
    let segIdx = 0;
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      if (seg && seg.startMs <= barMidMs && seg.endMs > barMidMs) {
        segIdx = s;
        break;
      }
      if (s === segments.length - 1) {
        segIdx = s;
      }
    }

    const segment = segments[segIdx];
    if (!segment) {
      continue;
    }

    bars.push({
      color: segment.speakerColor,
      height: segment.barHeight,
      segmentIndex: segIdx,
      x: i * (barWidth + BAR_GAP),
    });
  }

  return bars;
}

// ============================================================================
// TOOLTIP
// ============================================================================

type TooltipData = {
  speakerName: string;
  timeMs: number;
  x: number;
};

function formatTimeMs(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function abbreviateName(name: string): string {
  const cleaned = name.replace(/\s*\(.*\)\s*$/, '').trim();
  const words = cleaned.split(/\s+/);
  return words.length <= 2 ? cleaned : words.slice(0, 2).join(' ');
}

// ============================================================================
// MEMOIZED BAR
// ============================================================================

const WaveformBar = memo(({
  color,
  height,
  width,
  x,
}: {
  color: string;
  height: number;
  width: number;
  x: number;
}) => {
  const barHeight = Math.max(4, height * (WAVEFORM_HEIGHT - 4));
  const y = (WAVEFORM_HEIGHT - barHeight) / 2;

  return (
    <rect
      fill={color}
      height={barHeight}
      rx={1}
      width={width}
      x={x}
      y={y}
    />
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WaveformTimeline({
  className,
  currentTime,
  duration,
  onSeek,
  segments,
}: WaveformTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const playheadRef = useRef<SVGLineElement>(null);
  const clipRectRef = useRef<SVGRectElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [svgWidth, setSvgWidth] = useState(340);

  // Measure container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSvgWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Partial episode / generation progress from store
  const currentEpisode = usePodcastStore(s => s.episodes[s.currentEpisodeIndex]);
  const generationProgress = usePodcastStore(s => s.generationProgress);
  const isPartial = currentEpisode?.isPartial ?? false;

  const barWidth = (svgWidth - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
  const bars = computeBars(segments, svgWidth);
  const totalDurationMs = segments.length > 0 ? (segments[segments.length - 1]?.endMs ?? 0) : 0;

  // For partial episodes, calculate how many bars represent loaded audio
  const loadedBarCount = useMemo(() => {
    if (!isPartial || !generationProgress) {
      return BAR_COUNT;
    }

    // If all episodes are completed, full waveform is loaded
    if (generationProgress.completed >= generationProgress.total) {
      return BAR_COUNT;
    }

    // Find progress for the current episode by matching roundNumber
    const currentRound = currentEpisode?.roundNumber;
    const episodeProgress = currentRound !== null && currentRound !== undefined
      ? generationProgress.episodes.find(ep => ep.roundNumber === currentRound)
      : generationProgress.episodes[0];

    const fraction = episodeProgress
      ? Math.min(episodeProgress.progress / 100, 1)
      : 0;

    return Math.floor(BAR_COUNT * fraction);
  }, [isPartial, generationProgress, currentEpisode?.roundNumber]);

  // Update playhead via refs (zero React re-renders)
  useEffect(() => {
    if (!playheadRef.current || !clipRectRef.current || duration <= 0) {
      return;
    }

    const progress = currentTime / duration;
    const playheadX = progress * svgWidth;

    playheadRef.current.setAttribute('x1', String(playheadX));
    playheadRef.current.setAttribute('x2', String(playheadX));
    clipRectRef.current.setAttribute('width', String(playheadX));
  }, [currentTime, duration, svgWidth]);

  // Click to seek (clamped to loaded portion for partial episodes)
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || duration <= 0) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, clickX / rect.width));

    // Clamp to loaded portion for partial episodes
    const maxProgress = isPartial && loadedBarCount < BAR_COUNT
      ? loadedBarCount / BAR_COUNT
      : 1;
    const clampedProgress = Math.min(progress, maxProgress);

    onSeek(clampedProgress * duration);
  }, [duration, isPartial, loadedBarCount, onSeek]);

  // Hover for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || totalDurationMs <= 0) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, hoverX / rect.width));
    const timeMs = progress * totalDurationMs;

    // Find segment at this time
    const segment = segments.find(s => s.startMs <= timeMs && s.endMs > timeMs)
      ?? segments[segments.length - 1];

    if (segment) {
      setTooltip({
        speakerName: segment.speakerName,
        timeMs,
        x: hoverX,
      });
    }
  }, [segments, totalDurationMs]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (segments.length === 0) {
    return null;
  }

  const clipId = 'waveform-played-clip';

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* SVG Waveform */}
      <svg
        ref={svgRef}
        className="w-full cursor-pointer"
        height={WAVEFORM_HEIGHT}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        viewBox={`0 0 ${svgWidth} ${WAVEFORM_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <defs>
          <clipPath id={clipId}>
            <rect ref={clipRectRef} height={WAVEFORM_HEIGHT} width={0} x={0} y={0} />
          </clipPath>
        </defs>

        {/* Unplayed loaded bars (normal dimmed) */}
        <g opacity={0.2}>
          {bars.map((bar, i) => {
            if (isPartial && i >= loadedBarCount) {
              return null;
            }
            return (
              <WaveformBar
                // eslint-disable-next-line react/no-array-index-key
                key={`u-${i}`}
                color={bar.color}
                height={bar.height}
                width={barWidth}
                x={bar.x}
              />
            );
          })}
        </g>

        {/* Ungenerated bars (skeleton placeholder) */}
        {isPartial && loadedBarCount < BAR_COUNT && (
          <g opacity={0.08} className="animate-pulse">
            {bars.map((bar, i) => {
              if (i < loadedBarCount) {
                return null;
              }
              return (
                <WaveformBar
                  // eslint-disable-next-line react/no-array-index-key
                  key={`g-${i}`}
                  color="#52525b"
                  height={bar.height * 0.6}
                  width={barWidth}
                  x={bar.x}
                />
              );
            })}
          </g>
        )}

        {/* Played bars (bright, clipped to playhead) */}
        <g clipPath={`url(#${clipId})`} opacity={0.85}>
          {bars.map((bar, i) => {
            if (isPartial && i >= loadedBarCount) {
              return null;
            }
            return (
              <WaveformBar
                // eslint-disable-next-line react/no-array-index-key
                key={`p-${i}`}
                color={bar.color}
                height={bar.height}
                width={barWidth}
                x={bar.x}
              />
            );
          })}
        </g>

        {/* Block interaction on ungenerated region */}
        {isPartial && loadedBarCount < BAR_COUNT && (
          <rect
            x={loadedBarCount * (barWidth + BAR_GAP)}
            y={0}
            width={svgWidth - loadedBarCount * (barWidth + BAR_GAP)}
            height={WAVEFORM_HEIGHT}
            fill="transparent"
            className="cursor-not-allowed"
            onClick={e => e.stopPropagation()}
          />
        )}

        {/* Generation boundary line for partial episodes */}
        {isPartial && loadedBarCount < BAR_COUNT && (() => {
          const boundaryX = loadedBarCount * (barWidth + BAR_GAP);
          return (
            <>
              {/* Glow behind boundary */}
              <line
                stroke="white"
                strokeOpacity={0.15}
                strokeWidth={4}
                x1={boundaryX}
                x2={boundaryX}
                y1={0}
                y2={WAVEFORM_HEIGHT}
              />
              {/* Boundary line */}
              <line
                className="animate-pulse"
                stroke="white"
                strokeOpacity={0.5}
                strokeWidth={1.5}
                x1={boundaryX}
                x2={boundaryX}
                y1={0}
                y2={WAVEFORM_HEIGHT}
              />
            </>
          );
        })()}

        {/* Playhead line */}
        <line
          ref={playheadRef}
          stroke="white"
          strokeWidth={2}
          x1={0}
          x2={0}
          y1={0}
          y2={WAVEFORM_HEIGHT}
        />
      </svg>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="absolute -top-10 pointer-events-none z-10 flex items-center gap-1.5 px-2 py-1 rounded-md backdrop-blur-xl bg-background/60 border border-white/15 shadow-lg"
          style={{
            left: Math.max(0, Math.min(tooltip.x - 60, svgWidth - 120)),
          }}
        >
          <img
            src={getSpeakerProviderIcon(tooltip.speakerName)}
            alt=""
            className="size-3 rounded-full"
          />
          <span className="text-[10px] text-white/70 truncate max-w-[80px]">
            {abbreviateName(tooltip.speakerName)}
          </span>
          <span className="text-[10px] text-white/40 tabular-nums">
            {formatTimeMs(tooltip.timeMs)}
          </span>
        </div>
      )}
    </div>
  );
}
