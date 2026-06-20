'use client';

import { memo, useRef, useState } from 'react';

import { Icons } from '@/components/icons';
import { cn } from '@/lib/ui/cn';
import { copyToClipboard } from '@/lib/utils/clipboard';

type Tab = {
  code: string;
  label: string;
};

type MCPCodeBlockProps = {
  tabs: readonly Tab[];
};

export const MCPCodeBlock = memo(({ tabs }: MCPCodeBlockProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    void copyToClipboard(tabs[activeTab]?.code ?? '');
    setCopied(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(setCopied, 2000, false);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-[#0d1117] min-w-0 w-full">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex min-w-0 overflow-x-auto">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveTab(i)}
              className={cn(
                'px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-medium transition-colors',
                activeTab === i
                  ? 'text-teal-400 border-b-2 border-teal-400'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copy code"
        >
          {copied
            ? <Icons.check className="size-3.5 text-teal-400" />
            : <Icons.copy className="size-3.5" />}
        </button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto min-w-0">
        <pre className="p-3 sm:p-4 text-xs sm:text-sm font-mono leading-relaxed text-gray-300 whitespace-pre-wrap break-all">
          <code>{tabs[activeTab]?.code}</code>
        </pre>
      </div>
    </div>
  );
});
