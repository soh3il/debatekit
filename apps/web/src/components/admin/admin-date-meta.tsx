/**
 * Admin Date Meta
 *
 * Consistent date/time display for admin cards.
 * Renders a row of date entries separated by middots.
 */

import { Icons } from '@/components/icons';
import { formatDuration } from '@/lib/format';

type DateEntry = {
  date: Date | string;
  label?: string;
};

type AdminDateMetaProps = {
  completedAt?: Date | string | null;
  entries?: DateEntry[];
  startedAt?: Date | string | null;
};

function AdminDateMeta({ completedAt, entries, startedAt }: AdminDateMetaProps) {
  const items: React.ReactNode[] = [];

  if (entries) {
    for (const entry of entries) {
      const formatted = new Date(entry.date).toLocaleDateString();
      items.push(
        <span key={entry.label ?? formatted}>
          {entry.label ? `${entry.label} ${formatted}` : formatted}
        </span>,
      );
    }
  }

  if (startedAt && completedAt) {
    items.push(
      <span key="duration" className="flex items-center gap-1">
        <Icons.clock className="size-3" />
        {formatDuration(
          typeof startedAt === 'string' ? startedAt : startedAt.toISOString(),
          typeof completedAt === 'string' ? completedAt : completedAt.toISOString(),
        )}
      </span>,
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map((item, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <span key={i} className="contents">
          {i > 0 && <span>&middot;</span>}
          {item}
        </span>
      ))}
    </div>
  );
}

export { AdminDateMeta };
