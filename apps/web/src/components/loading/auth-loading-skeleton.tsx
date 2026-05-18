import { AuthShowcaseLayout } from '@/components/auth/auth-showcase-layout';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Auth Page Loading Skeleton
 * Used during authentication checks and form loading
 */
export function AuthLoadingSkeleton() {
  return (
    <AuthShowcaseLayout>
      <div className="flex flex-col gap-4 pt-10">
        <Skeleton className="h-14 w-full rounded-full" />
        <Skeleton className="h-14 w-full rounded-full" />
      </div>
    </AuthShowcaseLayout>
  );
}
