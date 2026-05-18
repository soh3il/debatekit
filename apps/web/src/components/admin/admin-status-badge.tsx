/**
 * Admin Status Badge
 *
 * Unified status badge component for all admin entity types.
 * Renders icon + label with correct variant and animation.
 */

import type {
  AutomatedJobStatus,
  ContentPipelineStatus,
  ScheduledTweetStatus,
} from '@debatekit/shared/enums';

import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui/cn';
import type { StatusConfig } from '@/lib/ui/status-config';
import { getJobStatusConfig, getPipelineStatusConfig, getTweetStatusConfig } from '@/lib/ui/status-config';

// ---------------------------------------------------------------------------
// Generic badge renderer (shared by all variants)
// ---------------------------------------------------------------------------

function StatusBadge({ config, label }: { config: StatusConfig; label: string }) {
  const { icon: StatusIcon, isAnimated, variant } = config;

  return (
    <Badge variant={variant} className="flex items-center gap-1 shrink-0">
      <StatusIcon className={cn('size-3', isAnimated && 'animate-spin')} />
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Entity-specific badges
// ---------------------------------------------------------------------------

function AdminJobStatusBadge({ status }: { status: AutomatedJobStatus }) {
  const t = useTranslations();
  return <StatusBadge config={getJobStatusConfig(status)} label={t(`admin.jobs.status.${status}`)} />;
}

function AdminTweetStatusBadge({ status }: { status: ScheduledTweetStatus }) {
  const t = useTranslations();
  return <StatusBadge config={getTweetStatusConfig(status)} label={t(`admin.tweets.status.${status}`)} />;
}

function AdminPipelineStatusBadge({ status }: { status: ContentPipelineStatus }) {
  const t = useTranslations();
  return <StatusBadge config={getPipelineStatusConfig(status)} label={t(`admin.pipeline.status.${status}`)} />;
}

export { AdminJobStatusBadge, AdminPipelineStatusBadge, AdminTweetStatusBadge };
