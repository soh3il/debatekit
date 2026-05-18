/**
 * Speaker Color Utility
 *
 * Deterministic color assignment for podcast speakers based on first-appearance order.
 * Moderator gets slate, participants get unique colors from a curated palette.
 */

import { BRAND } from '@debatekit/shared';
import { PodcastScriptLineRoles } from '@debatekit/shared/enums';

import type { PodcastScriptLine } from '@/services/api/chat/podcast';

// 8-color palette for participants — sourced from BRAND.logoGradient
const SPEAKER_PALETTE = [
  BRAND.logoGradient[6], // Blue
  BRAND.logoGradient[2], // Deep Pink/Magenta
  BRAND.logoGradient[9], // Green
  BRAND.logoGradient[1], // Deep Orange
  BRAND.logoGradient[7], // Cyan
  BRAND.logoGradient[3], // Purple
  BRAND.logoGradient[0], // Vibrant Gold/Yellow
  BRAND.logoGradient[8], // Teal
] as const;

const NARRATOR_COLOR = '#94a3b8'; // slate-400
const MODERATOR_COLOR = '#e879f9'; // fuchsia-400 — distinct from narrator

/**
 * Build a deterministic speaker → color mapping from script lines.
 * Colors assigned by first-appearance order.
 * Narrator (host/MC) gets slate, Council Moderator gets fuchsia, participants get palette.
 */
export function buildSpeakerColorMap(scriptLines: PodcastScriptLine[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  let paletteIndex = 0;

  for (const line of scriptLines) {
    if (colorMap.has(line.speakerId)) {
      continue;
    }

    if (line.role === PodcastScriptLineRoles.NARRATOR) {
      colorMap.set(line.speakerId, NARRATOR_COLOR);
    } else if (line.role === PodcastScriptLineRoles.MODERATOR) {
      colorMap.set(line.speakerId, MODERATOR_COLOR);
    } else {
      const color = SPEAKER_PALETTE[paletteIndex % SPEAKER_PALETTE.length] ?? SPEAKER_PALETTE[0];
      colorMap.set(line.speakerId, color);
      paletteIndex++;
    }
  }

  return colorMap;
}
