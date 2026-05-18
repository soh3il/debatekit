import { ScheduledTweetStatuses } from '@debatekit/shared/enums';
import { useMemo, useState } from 'react';
import { z } from 'zod';

import {
  AdminContentList,
  AdminEmptyState,
  AdminSectionCard,
} from '@/components/admin';
import { TweetDeleteDialog } from '@/components/admin/tweets/tweet-delete-dialog';
import { TweetEditDialog } from '@/components/admin/tweets/tweet-edit-dialog';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSendTweetMutation, useUpdateTweetMutation } from '@/hooks/mutations';
import { useAdminTweetsInfiniteQuery } from '@/hooks/queries';
import { useAdminInfiniteScroll } from '@/hooks/utils/use-admin-infinite-scroll';
import { getWebappEnvFromEnv } from '@/lib/env';
import { useTranslations } from '@/lib/i18n';
import { toastManager } from '@/lib/toast';
import type { ScheduledTweet } from '@/services/api';

import { TweetCard } from './tweet-card';
import { TweetCreateDialog } from './tweet-create-dialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TWEET_FILTER_VALUES = ['all', 'draft', 'failed', 'scheduled', 'sent'] as const;
const TweetFilterSchema = z.enum(TWEET_FILTER_VALUES);
type TweetFilter = z.infer<typeof TweetFilterSchema>;
const TweetFilters = {
  ALL: 'all',
  DRAFT: 'draft',
  FAILED: 'failed',
  SCHEDULED: 'scheduled',
  SENT: 'sent',
} as const;

const TWEET_FILTER_STATUSES: Record<TweetFilter, string | null> = {
  [TweetFilters.ALL]: null,
  [TweetFilters.DRAFT]: ScheduledTweetStatuses.DRAFT,
  [TweetFilters.FAILED]: ScheduledTweetStatuses.FAILED,
  [TweetFilters.SCHEDULED]: ScheduledTweetStatuses.SCHEDULED,
  [TweetFilters.SENT]: ScheduledTweetStatuses.SENT,
};

// ---------------------------------------------------------------------------
// SocialChannelsContent — reusable inner content (no wrapper card)
// ---------------------------------------------------------------------------

export function SocialChannelsContent({
  createDialogOpen: controlledOpen,
  setCreateDialogOpen: controlledSetOpen,
}: {
  createDialogOpen?: boolean;
  setCreateDialogOpen?: (open: boolean) => void;
} = {}) {
  const t = useTranslations();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isPending,
  } = useAdminTweetsInfiniteQuery();
  const sendMutation = useSendTweetMutation();
  const updateMutation = useUpdateTweetMutation();

  const [internalOpen, setInternalOpen] = useState(false);
  const createDialogOpen = controlledOpen ?? internalOpen;
  const setCreateDialogOpen = controlledSetOpen ?? setInternalOpen;

  const [tweetFilter, setTweetFilter] = useState<TweetFilter>('all');
  const [editingTweet, setEditingTweet] = useState<ScheduledTweet | null>(null);
  const [tweetToDelete, setTweetToDelete] = useState<ScheduledTweet | null>(null);
  const [sendingTweetId, setSendingTweetId] = useState<string | null>(null);
  const [unschedulingTweetId, setUnschedulingTweetId] = useState<string | null>(null);
  const { scrollRef } = useAdminInfiniteScroll({ fetchNextPage, hasNextPage, isFetchingNextPage });

  const allTweets = useMemo(() => data?.pages.flatMap(page => page.data.tweets) ?? [], [data]);

  const tweets = useMemo(() => {
    const allowedStatus = TWEET_FILTER_STATUSES[tweetFilter];
    if (!allowedStatus) {
      return allTweets;
    }
    return allTweets.filter(tweet => tweet.status === allowedStatus);
  }, [allTweets, tweetFilter]);

  // Filter counts
  const filterCounts = useMemo(() => ({
    all: allTweets.length,
    draft: allTweets.filter(t => t.status === ScheduledTweetStatuses.DRAFT).length,
    failed: allTweets.filter(t => t.status === ScheduledTweetStatuses.FAILED).length,
    scheduled: allTweets.filter(t => t.status === ScheduledTweetStatuses.SCHEDULED).length,
    sent: allTweets.filter(t => t.status === ScheduledTweetStatuses.SENT).length,
  }), [allTweets]);

  const handleSend = (tweet: ScheduledTweet) => {
    setSendingTweetId(tweet.id);
    sendMutation.mutate(
      { param: { id: tweet.id } },
      {
        onError: () => {
          toastManager.error(t('admin.tweets.sendError'));
          setSendingTweetId(null);
        },
        onSuccess: () => {
          toastManager.success(t('admin.tweets.tweetQueued'));
          setSendingTweetId(null);
        },
      },
    );
  };

  const handleDelete = (tweet: ScheduledTweet) => {
    setTweetToDelete(tweet);
  };

  const handleUnschedule = (tweet: ScheduledTweet) => {
    setUnschedulingTweetId(tweet.id);
    updateMutation.mutate(
      { json: { status: 'draft' as const }, param: { id: tweet.id } },
      {
        onError: () => {
          toastManager.error(t('admin.tweets.unscheduleError'));
          setUnschedulingTweetId(null);
        },
        onSuccess: () => {
          toastManager.success(t('admin.tweets.unscheduled'));
          setUnschedulingTweetId(null);
        },
      },
    );
  };

  const tweetFilterTabs = useMemo(() => [
    { count: filterCounts.all, label: t('admin.tweets.filter.all'), value: 'all' },
    { count: filterCounts.draft, label: t('admin.tweets.filter.draft'), value: 'draft' },
    { count: filterCounts.scheduled, label: t('admin.tweets.filter.scheduled'), value: 'scheduled' },
    { count: filterCounts.sent, label: t('admin.tweets.filter.sent'), value: 'sent' },
    { count: filterCounts.failed, label: t('admin.tweets.filter.failed'), value: 'failed' },
  ], [filterCounts, t]);

  return (
    <>
      <Tabs defaultValue="twitter">
        <TabsList className="mb-3">
          <TabsTrigger value="twitter" className="gap-1.5">
            <Icons.twitter className="size-3.5" />
            {' '}
            {t('admin.tweets.twitterTab')}
          </TabsTrigger>
          <TabsTrigger value="linkedin" disabled className="gap-1.5">
            {t('admin.tweets.linkedinTab')}
            <Badge variant="outline" className="text-[10px] ml-1">{t('admin.tweets.soonBadge')}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="twitter">
          {getWebappEnvFromEnv() !== 'prod' && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 mb-3">
              <Icons.alertTriangle className="size-3.5 shrink-0 text-amber-400" />
              {t('admin.tweets.localModeWarning')}
            </div>
          )}

          <AdminContentList
            allItemCount={allTweets.length}
            filteredItemCount={tweets.length}
            isPending={isPending}
            isError={isError}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            scrollRef={scrollRef}
            scrollClassName="h-[340px]"
            errorMessage={t('admin.tweets.failedToLoadPosts')}
            noResultsMessage={t('admin.tweets.noPostsMatchFilter')}
            endOfListText={t('admin.tweets.allPostsLoaded')}
            filterTabs={tweetFilterTabs}
            filterValue={tweetFilter}
            onFilterChange={(v) => {
              const parsed = TweetFilterSchema.safeParse(v);
              if (parsed.success) {
                setTweetFilter(parsed.data);
              }
            }}
            skeletonCount={2}
            skeletonShowBadges={false}
            emptyState={(
              <AdminEmptyState
                actionIcon={<Icons.plus />}
                actionLabel={t('admin.tweets.newPost')}
                className="min-h-[200px] border-0"
                description={t('admin.tweets.noPostsDescription')}
                icon={<Icons.twitter />}
                onAction={() => setCreateDialogOpen(true)}
                title={t('admin.tweets.noPostsYet')}
              />
            )}
          >
            {tweets.map((tweet: ScheduledTweet) => (
              <TweetCard
                key={tweet.id}
                deletingTweetId={null}
                onDelete={handleDelete}
                onEdit={setEditingTweet}
                onSend={handleSend}
                onUnschedule={handleUnschedule}
                sendingTweetId={sendingTweetId}
                tweet={tweet}
                unschedulingTweetId={unschedulingTweetId}
              />
            ))}
          </AdminContentList>
        </TabsContent>
        <TabsContent value="linkedin">
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/30 ring-1 ring-white/10 mb-4">
              <Icons.briefcase className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t('admin.tweets.linkedinComingSoon')}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              {t('admin.tweets.linkedinDescription')}
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <TweetCreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <TweetDeleteDialog tweet={tweetToDelete} open={!!tweetToDelete} onOpenChange={open => !open && setTweetToDelete(null)} />
      <TweetEditDialog tweet={editingTweet} open={!!editingTweet} onOpenChange={open => !open && setEditingTweet(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// SocialChannelsSection
// ---------------------------------------------------------------------------

export function SocialChannelsSection() {
  const t = useTranslations();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <AdminSectionCard
      actions={(
        <Button size="sm" variant="glass" onClick={() => setCreateDialogOpen(true)} startIcon={<Icons.plus />}>
          {t('admin.tweets.newPost')}
        </Button>
      )}
      description={t('admin.tweets.socialChannelsDescription')}
      icon={<Icons.share className="size-4" />}
      title={t('admin.tweets.socialChannelsTitle')}
      titleExtra={<Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">{t('admin.pipeline.stepBadge', { step: 3 })}</Badge>}
    >
      <SocialChannelsContent createDialogOpen={createDialogOpen} setCreateDialogOpen={setCreateDialogOpen} />
    </AdminSectionCard>
  );
}
