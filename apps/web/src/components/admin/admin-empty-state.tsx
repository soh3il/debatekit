import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/ui/cn';

type AdminEmptyStateProps = {
  actionIcon?: ReactNode;
  actionLabel?: string;
  className?: string;
  description: string;
  icon: ReactNode;
  onAction?: () => void;
  title: string;
};

function AdminEmptyState({ actionIcon, actionLabel, className, description, icon, onAction, title }: AdminEmptyStateProps) {
  const hasAction = actionIcon && actionLabel && onAction;

  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center text-center px-4 sm:px-6 py-8 rounded-xl', className)}>
      <div className="size-12 mx-auto text-muted-foreground/50 [&>svg]:size-12">
        {icon}
      </div>
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      {hasAction && (
        <Button className="mt-4" variant="glass" onClick={onAction} startIcon={actionIcon}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export { AdminEmptyState };
