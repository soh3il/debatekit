import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/ui/cn';

type AdminSectionCardProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description: string;
  icon: ReactNode;
  tabs?: ReactNode;
  title: string;
  titleExtra?: ReactNode;
};

function AdminSectionCard({ actions, children, className, description, icon, tabs, title, titleExtra }: AdminSectionCardProps) {
  return (
    <Card variant="glass" className={cn('flex flex-col', className)}>
      <CardHeader className="pb-3 px-4 sm:px-6">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              {icon}
              {title}
              {titleExtra}
            </CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">
              {actions}
            </div>
          )}
        </div>
        {tabs}
      </CardHeader>
      <CardContent className="flex-1 pt-0 pb-4 px-4 sm:px-6 flex flex-col gap-3">
        {children}
      </CardContent>
    </Card>
  );
}

export { AdminSectionCard };
