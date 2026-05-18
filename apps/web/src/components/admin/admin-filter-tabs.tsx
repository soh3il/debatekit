/**
 * Admin Filter Tabs
 *
 * Reusable filter tab bar with counts, used across jobs, tweets, and pipeline sections.
 * Horizontally scrollable on mobile via ScrollArea component.
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type FilterTab = {
  count: number;
  label: string;
  value: string;
};

type AdminFilterTabsProps = {
  className?: string;
  onChange: (value: string) => void;
  tabs: FilterTab[];
  value: string;
};

function AdminFilterTabs({ className = 'mt-1', onChange, tabs, value }: AdminFilterTabsProps) {
  return (
    <Tabs value={value} onValueChange={onChange} className={className}>
      <ScrollArea orientation="horizontal" className="-mx-1 px-1 pb-1">
        <TabsList className="h-8 w-max transition-all duration-200">
          {tabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 text-xs">
              {tab.label}
              {' '}
              (
              {tab.count}
              )
            </TabsTrigger>
          ))}
        </TabsList>
      </ScrollArea>
    </Tabs>
  );
}

export { AdminFilterTabs };
export type { FilterTab };
