import type { ScheduledTweetStatus } from '@debatekit/shared/enums';
import { ScheduledTweetStatuses, TweetSources } from '@debatekit/shared/enums';

import {
  AdminActionButton,
  AdminActionRow,
  AdminDeleteButton,
  AdminExternalLinkButton,
  AdminItemCard,
  AdminItemError,
  AdminTweetStatusBadge,
  AdminViewThreadButton,
} from '@/components/admin';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateET, formatDateTimeET, getETHour } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui/cn';
import type { ScheduledTweet } from '@/services/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTweetError(tweet: ScheduledTweet) {
  return tweet.metadata?.errorMessage;
}

/**
 * Get rush hour window label from scheduledAt timestamp.
 * Windows: 9-10 AM ET = Morning, 12-1 PM ET = Lunch, 5-6 PM ET = Evening
 */
function getRushHourLabel(scheduledAt: string, t: (key: string) => string): string | null {
  const etHour = getETHour(scheduledAt);
  if (etHour >= 9 && etHour < 10) {
    return t('admin.tweets.rushHour.morning');
  }
  if (etHour >= 12 && etHour < 13) {
    return t('admin.tweets.rushHour.lunch');
  }
  if (etHour >= 17 && etHour < 18) {
    return t('admin.tweets.rushHour.evening');
  }
  return null;
}

const STATUS_BORDER_CLASSES: Record<ScheduledTweetStatus, string> = {
  cancelled: 'border-l-2 border-l-destructive/50 opacity-60',
  draft: 'border-l-2 border-l-primary',
  failed: 'border-l-2 border-l-destructive',
  scheduled: 'border-l-2 border-l-chart-4',
  sent: 'border-l-2 border-l-chart-3',
};

// ---------------------------------------------------------------------------
// TweetCard
// ---------------------------------------------------------------------------

export type TweetCardProps = {
  deletingTweetId: string | null;
  onDelete: (tweet: ScheduledTweet) => void;
  onEdit: (tweet: ScheduledTweet) => void;
  onSend: (tweet: ScheduledTweet) => void;
  onUnschedule: (tweet: ScheduledTweet) => void;
  sendingTweetId: string | null;
  tweet: ScheduledTweet;
  unschedulingTweetId: string | null;
};

export function TweetCard({
  deletingTweetId,
  onDelete,
  onEdit,
  onSend,
  onUnschedule,
  sendingTweetId,
  tweet,
  unschedulingTweetId,
}: TweetCardProps) {
  const t = useTranslations();

  const isDraft = tweet.status === ScheduledTweetStatuses.DRAFT;
  const isScheduled = tweet.status === ScheduledTweetStatuses.SCHEDULED;
  const isSent = tweet.status === ScheduledTweetStatuses.SENT;
  const isFailed = tweet.status === ScheduledTweetStatuses.FAILED;
  const isCancelled = tweet.status === ScheduledTweetStatuses.CANCELLED;

  const canSend = isDraft || isScheduled;
  const tweetError = extractTweetError(tweet);
  const isSending = sendingTweetId === tweet.id;
  const isDeleting = deletingTweetId === tweet.id;
  const isUnscheduling = unschedulingTweetId === tweet.id;

  return (
    <AdminItemCard className={STATUS_BORDER_CLASSES[tweet.status]}>
      {/* Content preview */}
      <div className="flex items-start justify-between gap-4">
        <p className={cn('text-sm flex-1 min-w-0 line-clamp-2', isCancelled && 'text-muted-foreground')}>
          {tweet.content}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <AdminTweetStatusBadge status={tweet.status} />
          {tweet.source === TweetSources.AUTOMATED_JOB && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {t('admin.tweets.source.automated_job')}
            </Badge>
          )}
        </div>
      </div>

      {/* Date info */}
      <div className="flex items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground flex-wrap">
        <Icons.clock className="size-3" />
        <span>{formatDateET(tweet.createdAt)}</span>
        {tweet.scheduledAt && (
          <>
            <span>&middot;</span>
            <span>
              {t('admin.tweets.scheduledLabel')}
              {' '}
              {formatDateTimeET(tweet.scheduledAt)}
            </span>
          </>
        )}
        {tweet.scheduledAt && (() => {
          const rushLabel = getRushHourLabel(tweet.scheduledAt, t);
          return rushLabel
            ? (
                <>
                  <span>&middot;</span>
                  <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 text-chart-4/80 border-chart-4/20">
                    {rushLabel}
                  </Badge>
                </>
              )
            : null;
        })()}
        {tweet.sentAt && (
          <>
            <span>&middot;</span>
            <span>
              {t('admin.tweets.sentLabel')}
              {' '}
              {formatDateTimeET(tweet.sentAt)}
            </span>
          </>
        )}
      </div>

      {/* Tweet metadata: style badge + viral score */}
      {(tweet.metadata?.tweetStyle || tweet.viralScore !== null) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {tweet.metadata?.tweetStyle && (
            <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
              {tweet.metadata.tweetStyle}
            </Badge>
          )}
          {tweet.viralScore !== null && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Icons.trendingUp className="size-3" />
              {t('admin.tweets.viralLabel')}
              {' '}
              <span className="font-semibold">{tweet.viralScore}</span>
            </span>
          )}
        </div>
      )}

      {/* Error message for failed tweets */}
      {isFailed && tweetError && (
        <AdminItemError message={tweetError} />
      )}

      {/* Actions */}
      {!isCancelled && (
        <AdminActionRow>
          {/* Send Now - draft/scheduled only */}
          {canSend && (
            <Button
              variant="glass"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              disabled={isSending}
              onClick={() => onSend(tweet)}
              startIcon={isSending
                ? <Icons.loader className="size-3.5 animate-spin" />
                : <Icons.arrowRight className="size-3.5" />}
            >
              {t('admin.tweets.sendNow')}
            </Button>
          )}

          {/* Edit - draft/scheduled only */}
          {canSend && (
            <AdminActionButton
              icon={<Icons.pencil className="size-3.5" />}
              label={t('actions.edit')}
              onClick={() => onEdit(tweet)}
            />
          )}

          {/* Unschedule - scheduled tweets only */}
          {isScheduled && (
            <AdminActionButton
              disabled={isUnscheduling}
              icon={isUnscheduling
                ? <Icons.loader className="size-3.5 animate-spin" />
                : <Icons.clock className="size-3.5" />}
              label={t('admin.tweets.unschedule')}
              onClick={() => onUnschedule(tweet)}
            />
          )}

          {/* External link - sent tweets with twitter post id */}
          {isSent && tweet.twitterPostId && (
            <AdminExternalLinkButton
              href={`https://twitter.com/i/web/status/${tweet.twitterPostId}`}
              label={t('admin.tweets.viewOnX')}
            />
          )}

          {/* View Thread link */}
          {tweet.threadSlug && (
            <AdminViewThreadButton href={`/public/chat/${tweet.threadSlug}`} label={t('admin.tweets.viewThread')} />
          )}

          {/* Retry - failed tweets only */}
          {isFailed && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              disabled={isSending}
              onClick={() => onSend(tweet)}
              startIcon={isSending
                ? <Icons.loader className="size-3.5 animate-spin" />
                : <Icons.refreshCw className="size-3.5" />}
            >
              {t('admin.tweets.retryText')}
            </Button>
          )}

          {/* Delete - draft/scheduled/failed only */}
          {(isDraft || isScheduled || isFailed) && (
            <AdminDeleteButton
              disabled={isDeleting}
              onClick={() => onDelete(tweet)}
            />
          )}
        </AdminActionRow>
      )}
    </AdminItemCard>
  );
}
