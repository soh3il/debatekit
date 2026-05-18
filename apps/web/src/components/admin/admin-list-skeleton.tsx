import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type AdminListSkeletonProps = {
  count?: number;
  showBadges?: boolean;
  showSteps?: boolean;
};

function AdminListSkeleton({ count = 3, showBadges = true, showSteps = false }: AdminListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} variant="glass" className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          {showSteps && (
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(j => (
                <Skeleton key={j} className="h-2 flex-1 rounded-full" />
              ))}
            </div>
          )}
          {showBadges && (
            <div className="flex gap-1">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          )}
          <Skeleton className="h-8 w-full" />
        </Card>
      ))}
    </div>
  );
}

export { AdminListSkeleton };
