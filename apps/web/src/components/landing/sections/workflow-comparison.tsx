import { cn } from '@/lib/ui/cn';

import type { AccentColor } from './accent-colors';
import { ACCENT_COLORS } from './accent-colors';
import { MotionSpan, quickTransition, subtleFade, VIEWPORT_ONCE } from './motion-variants';

type WorkflowComparisonProps = {
  accentColor: AccentColor;
  manualSteps: string[];
  debatekitSteps: string[];
  timeManual: string;
  timeDebateKit: string;
};

/**
 * Side-by-side manual vs DebateKit workflow comparison.
 *
 * Left column: "Manual" with struck-through steps and red time label.
 * Right column: "DebateKit" with accent-colored background, animated
 * step numbers, and green time label.
 */
export function WorkflowComparison({
  accentColor,
  debatekitSteps,
  manualSteps,
  timeDebateKit,
  timeManual,
}: WorkflowComparisonProps) {
  const colors = ACCENT_COLORS[accentColor];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Manual workflow */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-muted-foreground rounded-full px-3 py-1">
            Manual
          </span>
          <span className="text-sm font-medium text-red-400/70">
            {timeManual}
          </span>
        </div>
        <ol className="space-y-5">
          {manualSteps.map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex-shrink-0 size-6 rounded-full bg-white/[0.04] flex items-center justify-center text-xs font-medium text-muted-foreground/50">
                {i + 1}
              </span>
              <span className="text-sm text-muted-foreground/40 line-through">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* DebateKit workflow */}
      <div
        className={cn(
          'relative rounded-xl p-6 sm:p-8 border',
          colors.highlightBorder,
          colors.highlightBg,
        )}
      >
        <div className="flex items-center gap-3 mb-8">
          <span
            className={cn(
              'text-xs font-medium rounded-full px-3 py-1 border',
              colors.numberBg,
              colors.badgeBorder,
              colors.badgeText,
            )}
          >
            DebateKit
          </span>
          <span className="text-sm font-medium text-emerald-400">
            {timeDebateKit}
          </span>
        </div>
        <ol className="space-y-5">
          {debatekitSteps.map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <MotionSpan
                className={cn(
                  'flex-shrink-0 size-6 rounded-full flex items-center justify-center text-xs font-semibold',
                  colors.stepBg,
                  colors.stepText,
                )}
                initial={subtleFade.hidden}
                transition={{ ...quickTransition, delay: i * 0.1 }}
                viewport={VIEWPORT_ONCE}
                whileInView={subtleFade.visible}
              >
                {i + 1}
              </MotionSpan>
              <span className="text-sm">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
