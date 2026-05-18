import type { ReactNode, RefObject } from 'react';

import { AdminErrorState } from '@/components/admin/admin-error-state';
import type { FilterTab } from '@/components/admin/admin-filter-tabs';
import { AdminFilterTabs } from '@/components/admin/admin-filter-tabs';
import { AdminInfiniteScroll } from '@/components/admin/admin-infinite-scroll';
import { AdminListSkeleton } from '@/components/admin/admin-list-skeleton';
import { AdminNoResults } from '@/components/admin/admin-no-results';

type AdminContentListProps = {
  allItemCount: number;
  children: ReactNode;
  emptyState?: ReactNode;
  endOfListText: string;
  errorMessage: string;
  filterTabs?: FilterTab[];
  filterValue?: string;
  filteredItemCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  isPending: boolean;
  noResultsMessage: string;
  onFilterChange?: (value: string) => void;
  scrollClassName?: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  skeletonCount?: number;
  skeletonShowBadges?: boolean;
};

function AdminContentList({
  allItemCount,
  children,
  emptyState,
  endOfListText,
  errorMessage,
  filteredItemCount,
  filterTabs,
  filterValue,
  hasNextPage,
  isError,
  isFetchingNextPage,
  isPending,
  noResultsMessage,
  onFilterChange,
  scrollClassName = 'h-[340px]',
  scrollRef,
  skeletonCount,
  skeletonShowBadges,
}: AdminContentListProps) {
  return (
    <>
      {allItemCount > 0 && filterTabs && filterValue && onFilterChange && (
        <AdminFilterTabs tabs={filterTabs} value={filterValue} onChange={onFilterChange} />
      )}

      {isPending && <AdminListSkeleton count={skeletonCount} showBadges={skeletonShowBadges} />}

      {!isPending && isError && (
        <AdminErrorState className="min-h-[200px]" message={errorMessage} />
      )}

      {!isPending && !isError && allItemCount === 0 && emptyState}

      {!isPending && !isError && allItemCount > 0 && filteredItemCount === 0 && (
        <AdminNoResults className="min-h-[200px]" message={noResultsMessage} />
      )}

      {!isPending && !isError && filteredItemCount > 0 && (
        <AdminInfiniteScroll
          className={scrollClassName}
          endOfListText={endOfListText}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          itemCount={filteredItemCount}
          viewportRef={scrollRef}
        >
          {children}
        </AdminInfiniteScroll>
      )}
    </>
  );
}

export { AdminContentList };
