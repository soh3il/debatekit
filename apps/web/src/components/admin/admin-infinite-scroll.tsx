import type { ReactNode, RefObject } from 'react';

import { Icons } from '@/components/icons';
import { ScrollArea } from '@/components/ui/scroll-area';

type AdminInfiniteScrollProps = {
  children: ReactNode;
  className?: string;
  endOfListText: string;
  endOfListThreshold?: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  itemCount: number;
  viewportRef: RefObject<HTMLDivElement | null>;
};

function AdminInfiniteScroll({
  children,
  className = 'h-[50vh]',
  endOfListText,
  endOfListThreshold = 5,
  hasNextPage,
  isFetchingNextPage,
  itemCount,
  viewportRef,
}: AdminInfiniteScrollProps) {
  return (
    <ScrollArea viewportRef={viewportRef} className={`${className} -mr-2 pr-2 sm:-mr-4 sm:pr-4`}>
      <div className="space-y-4">
        {children}

        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Icons.loader className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!hasNextPage && itemCount > endOfListThreshold && (
          <p className="text-center text-xs text-muted-foreground py-4">
            {endOfListText}
          </p>
        )}
      </div>
    </ScrollArea>
  );
}

export { AdminInfiniteScroll };
