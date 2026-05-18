import ReactMarkdown from 'react-markdown';

import { Icons } from '@/components/icons';
import { remarkPlugins } from '@/components/markdown/unified-markdown-components';
import { cn } from '@/lib/ui/cn';

type MemoryEntryCardProps = {
  section: string | null;
  text: string;
  isDeleting: boolean;
  onDelete: () => void;
};

export function MemoryEntryCard({ isDeleting, onDelete, section, text }: MemoryEntryCardProps) {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/40">
      <div className="flex-1 min-w-0">
        {section && (
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
            {section}
          </p>
        )}
        <div className="prose prose-sm dark:prose-invert prose-p:my-0 prose-ul:my-0 prose-li:my-0 text-sm leading-relaxed">
          <ReactMarkdown remarkPlugins={remarkPlugins}>
            {text}
          </ReactMarkdown>
        </div>
      </div>
      <button
        type="button"
        disabled={isDeleting}
        onClick={onDelete}
        className={cn(
          'p-1.5 rounded-md text-muted-foreground transition-colors shrink-0',
          isDeleting
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-destructive/10 hover:text-destructive',
        )}
      >
        {isDeleting
          ? <Icons.loader className="size-4 animate-spin" />
          : <Icons.trash className="size-4" />}
      </button>
    </div>
  );
}
