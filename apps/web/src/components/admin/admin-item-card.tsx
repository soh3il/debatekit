import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/ui/cn';

type AdminItemCardProps = {
  children: ReactNode;
  className?: string;
};

function AdminItemCard({ children, className }: AdminItemCardProps) {
  return (
    <Card
      variant="glass"
      className={cn('!py-3 px-3 sm:!py-4 sm:px-4 space-y-2.5 sm:space-y-3 transition-all duration-200', className)}
    >
      {children}
    </Card>
  );
}

export { AdminItemCard };
