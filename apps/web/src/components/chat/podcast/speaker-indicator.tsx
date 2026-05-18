'use client';

import { cn } from '@/lib/ui/cn';

import { getSpeakerProviderIcon } from './speaker-utils';

type SpeakerIndicatorProps = {
  className?: string;
  color?: string;
  speakerName: string;
};

/**
 * Animated voice bars that replace the static colored dot.
 * Three bars animate at staggered intervals to create a sound wave effect
 * flowing from the DebateKit logo toward the speaker icon.
 */
function VoiceBars({ color }: { color: string }) {
  return (
    <span className="flex items-center gap-[2px] h-3.5 shrink-0">
      <span
        className="w-[2px] rounded-full animate-[voice-bar-1_0.8s_ease-in-out_infinite]"
        style={{ backgroundColor: color }}
      />
      <span
        className="w-[2px] rounded-full animate-[voice-bar-2_0.8s_ease-in-out_infinite_0.15s]"
        style={{ backgroundColor: color }}
      />
      <span
        className="w-[2px] rounded-full animate-[voice-bar-3_0.8s_ease-in-out_infinite_0.3s]"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

/**
 * Inline speaker display with voice animation and provider icon.
 * Used in the compact podcast player bar.
 */
export function SpeakerIndicator({ className, color, speakerName }: SpeakerIndicatorProps) {
  const lower = speakerName.toLowerCase();
  const isModerator = lower === 'council moderator' || lower === 'moderator';
  const iconUrl = isModerator ? null : getSpeakerProviderIcon(speakerName);

  return (
    <span className={cn('flex items-center gap-1.5 min-w-0', className)}>
      {color && <VoiceBars color={color} />}
      {iconUrl && (
        <img
          src={iconUrl}
          alt=""
          className="size-3.5 rounded-full shrink-0"
        />
      )}
      <span className="text-[13px] font-medium text-foreground/80 truncate">
        {speakerName}
      </span>
    </span>
  );
}
