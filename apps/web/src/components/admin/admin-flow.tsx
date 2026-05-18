import { Icons } from '@/components/icons';
import { cn } from '@/lib/ui';

// ---------------------------------------------------------------------------
// Step Colors
// ---------------------------------------------------------------------------

export const DEFAULT_STEP_COLOR = { bg: 'bg-primary/15', border: 'border-primary/25', ring: 'ring-primary/25', text: 'text-primary' };
export const STEP_COLORS: Record<number, { bg: string; border: string; ring: string; text: string }> = {
  1: DEFAULT_STEP_COLOR,
  2: { bg: 'bg-chart-3/15', border: 'border-chart-3/25', ring: 'ring-chart-3/25', text: 'text-chart-3' },
  3: { bg: 'bg-chart-4/15', border: 'border-chart-4/25', ring: 'ring-chart-4/25', text: 'text-chart-4' },
};

// ---------------------------------------------------------------------------
// StepBadge
// ---------------------------------------------------------------------------

export function StepBadge({ step }: { step: number }) {
  const colors = STEP_COLORS[step] ?? DEFAULT_STEP_COLOR;
  return (
    <span className={cn(
      'inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold ring-1',
      colors.bg,
      colors.text,
      colors.ring,
    )}
    >
      {step}
    </span>
  );
}

// ---------------------------------------------------------------------------
// FlowConnector
// ---------------------------------------------------------------------------

export function FlowConnector() {
  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center text-muted-foreground/50">
        <div className="h-8 w-px bg-gradient-to-b from-white/25 to-white/10" />
        <Icons.chevronDown className="size-4 -mt-0.5" />
      </div>
    </div>
  );
}
