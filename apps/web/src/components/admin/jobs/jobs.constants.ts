import { AUTOMATED_JOB_STATUSES } from '@debatekit/shared/enums';
import { z } from 'zod';

import { formatTimeET } from '@/lib/format';

// ---------------------------------------------------------------------------
// Schedule helpers
// ---------------------------------------------------------------------------

export function getNextRunTime(lastCompletedAt: string | null) {
  if (!lastCompletedAt) {
    return null;
  }
  const next = new Date(lastCompletedAt).getTime() + 12 * 60 * 60 * 1000;
  if (next < Date.now()) {
    return null;
  }
  return formatTimeET(next);
}

// ---------------------------------------------------------------------------
// Status Filter (5-part enum, UI-specific)
// ---------------------------------------------------------------------------

export const STATUS_FILTER_VALUES = ['all', ...AUTOMATED_JOB_STATUSES] as const;
export const DEFAULT_STATUS_FILTER: StatusFilter = 'all';
export const StatusFilterSchema = z.enum(STATUS_FILTER_VALUES);
export type StatusFilter = z.infer<typeof StatusFilterSchema>;
export const StatusFilters = { ALL: 'all', CANCELLED: 'cancelled', COMPLETED: 'completed', FAILED: 'failed', PENDING: 'pending', RUNNING: 'running' } as const;
