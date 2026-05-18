import { CardVariants } from '@debatekit/shared';

import { Card } from '@/components/ui/card';

type TerminalCardProps = {
  children: React.ReactNode;
  label: string;
  labelColor?: string;
};

/**
 * Terminal-style card with macOS-style chrome header (three dots + label).
 * Reused across landing pages for before/after comparisons.
 */
export function TerminalCard({
  children,
  label,
  labelColor = 'text-gray-500',
}: TerminalCardProps) {
  return (
    <Card variant={CardVariants.GLASS_SUBTLE} className="overflow-hidden h-full p-0 shadow-none border-white/[0.06] min-w-0">
      {/* Terminal chrome */}
      <div className="flex items-center h-8 bg-[rgba(30,30,30,0.9)] px-3 gap-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-red-500/60" />
          <div className="size-2.5 rounded-full bg-yellow-500/60" />
          <div className="size-2.5 rounded-full bg-green-500/60" />
        </div>
        <span className={`text-[10px] font-mono uppercase tracking-wider ${labelColor}`}>{label}</span>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-5 font-mono text-xs sm:text-sm leading-relaxed space-y-2.5 sm:space-y-3 break-words overflow-hidden">
        {children}
      </div>
    </Card>
  );
}
