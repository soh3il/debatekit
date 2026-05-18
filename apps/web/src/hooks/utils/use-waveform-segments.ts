/**
 * Waveform Segments Hook
 *
 * Computes timeline segments from podcast script lines for the SVG waveform.
 * Uses backend timing (startMs/endMs) when available, falls back to
 * character-proportional estimation.
 */

import { useMemo } from 'react';

import type { PodcastScriptLine } from '@/services/api/chat/podcast';

export type WaveformSegment = {
  barHeight: number; // 0-1 normalized
  endMs: number;
  speakerColor: string;
  speakerId: string;
  speakerName: string;
  startMs: number;
};

const MIN_BAR_HEIGHT = 0.15;

/**
 * Compute waveform segments from script lines.
 *
 * If lines have `startMs`/`endMs` from backend, uses those directly.
 * Otherwise distributes duration proportionally by character count.
 * Bar height normalized from text length (min 15%, max 100%).
 */
export function useWaveformSegments(
  scriptLines: PodcastScriptLine[],
  durationMs: number,
  speakerColorMap: Map<string, string>,
): WaveformSegment[] {
  return useMemo(() => {
    if (scriptLines.length === 0 || durationMs <= 0) {
      return [];
    }

    // Check if backend timing is available (first line has startMs)
    const hasBackendTiming = scriptLines[0]?.startMs !== undefined;

    // Find max text length for bar height normalization
    const maxTextLength = Math.max(...scriptLines.map(l => l.text.length), 1);

    if (hasBackendTiming) {
      return scriptLines.map(line => ({
        barHeight: Math.max(MIN_BAR_HEIGHT, line.text.length / maxTextLength),
        endMs: line.endMs ?? durationMs,
        speakerColor: speakerColorMap.get(line.speakerId) ?? '#94a3b8',
        speakerId: line.speakerId,
        speakerName: line.speakerName,
        startMs: line.startMs ?? 0,
      }));
    }

    // Fallback: character-proportional estimation with audio tags stripped
    const effectiveLengths = scriptLines.map(l => l.text.replace(/\[[^\]]*\]/g, '').trim().length || 1);
    const totalChars = effectiveLengths.reduce((sum, len) => sum + len, 0);
    if (totalChars === 0) {
      return [];
    }

    let currentMs = 0;

    return scriptLines.map((line, i) => {
      const proportion = (effectiveLengths[i] ?? 1) / totalChars;
      const segmentDuration = proportion * durationMs;
      const startMs = currentMs;
      const endMs = currentMs + segmentDuration;
      currentMs = endMs;

      return {
        barHeight: Math.max(MIN_BAR_HEIGHT, line.text.length / maxTextLength),
        endMs,
        speakerColor: speakerColorMap.get(line.speakerId) ?? '#94a3b8',
        speakerId: line.speakerId,
        speakerName: line.speakerName,
        startMs,
      };
    });
  }, [scriptLines, durationMs, speakerColorMap]);
}
