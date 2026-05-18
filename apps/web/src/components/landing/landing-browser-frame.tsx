import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

export function LandingBrowserFrame({
  children,
  className,
  url = 'debatekit.com/chat',
}: {
  children: ReactNode;
  className?: string;
  url?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border border-white/10 overflow-hidden',
        'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4),0_0_80px_rgba(0,0,0,0.12)]',
        className,
      )}
    >
      {/* Title Bar */}
      <div className="flex items-center h-9 bg-[rgba(30,30,30,0.9)] px-3 gap-3 shrink-0">
        {/* Traffic Lights */}
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-[#ff5f56]" />
          <div className="size-3 rounded-full bg-[#ffbd2e]" />
          <div className="size-3 rounded-full bg-[#27ca3f]" />
        </div>

        {/* URL Bar */}
        <div className="flex-1 flex justify-center pr-11">
          <div className="h-6 bg-white/10 rounded-md flex items-center justify-center px-4 min-w-[200px] max-w-[400px]">
            <span className="text-xs font-medium text-white/60 select-none">{url}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
