/**
 * Memory Saved Notification
 *
 * Small inline notification shown above user message when memory was auto-extracted.
 * Shows summary of what was saved with an undo button.
 */

import { BrainIcon, UndoIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

type MemorySavedNotificationProps = {
  onUndo: () => void;
  summary: string;
};

export function MemorySavedNotification({ onUndo, summary }: MemorySavedNotificationProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/5 px-3 py-1.5 text-xs text-muted-foreground max-w-fit">
      <BrainIcon className="size-3.5 shrink-0 text-primary/60" />
      <span className="max-w-[300px] truncate">
        {'Saved: '}
        {summary}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-5 shrink-0"
        onClick={() => {
          onUndo();
          setDismissed(true);
        }}
      >
        <UndoIcon className="size-3" />
      </Button>
    </div>
  );
}
