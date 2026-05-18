import { ACTIVE_GENERATION_STATUSES, ComponentSizes, ComponentVariants, PodcastStatuses } from '@debatekit/shared';
import { UserRoles } from '@debatekit/shared/enums';
import { usePostHog } from 'posthog-js/react';
import { useMemo, useState } from 'react';

import type { ChatRenameDialogProps } from '@/components/chat/chat-rename-dialog';
import { ChatThreadMenuItems } from '@/components/chat/chat-thread-menu-items';
import type { ShareDialogProps } from '@/components/chat/share-dialog';
import { SocialShareButton } from '@/components/chat/social-share-button';
import { Icons } from '@/components/icons';
import { useChatStore } from '@/components/providers';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CHAT_UI_EVENTS, ENGAGEMENT_EVENTS } from '@/constants/analytics';
import { useEnablePodcastMutation, useToggleFavoriteMutation, useTogglePublicMutation } from '@/hooks/mutations';
import { useThreadQuery } from '@/hooks/queries';
import { usePodcastEpisodesQuery } from '@/hooks/queries/chat/podcast';
import { useMediaQuery } from '@/hooks/utils';
import { useSession } from '@/lib/auth/client';
import { getAppBaseUrl } from '@/lib/config/base-urls';
import { useTranslations } from '@/lib/i18n';
import { useShallow } from '@/lib/store';
import dynamic from '@/lib/utils/dynamic';
import type { ChatThread, ChatThreadFlexible } from '@/services/api';
import { getPodcastAudioUrl } from '@/services/api';
import { ChatPhases } from '@/stores/chat';
import type { PodcastEpisode } from '@/stores/podcast/store';
import { usePodcastStore } from '@/stores/podcast/store';

const PodcastHeaderButton = dynamic<{ threadId: string; disabled?: boolean }>(
  () => import('@/components/chat/podcast/podcast-header-button').then(m => ({ default: m.PodcastHeaderButton })),
  {
    loading: () => (
      <Button variant={ComponentVariants.GHOST} size={ComponentSizes.SM} disabled startIcon={<Icons.headphones />}>
        Listen
      </Button>
    ),
    ssr: false,
  },
);

const ShareDialog = dynamic<ShareDialogProps>(
  () => import('@/components/chat/share-dialog').then(m => ({ default: m.ShareDialog })),
  { ssr: false },
);

const ChatRenameDialog = dynamic<ChatRenameDialogProps>(
  () => import('@/components/chat/chat-rename-dialog').then(m => ({ default: m.ChatRenameDialog })),
  { ssr: false },
);

type ChatThreadActionsProps = {
  thread: ChatThread | ChatThreadFlexible;
  slug: string;
  onDeleteClick?: () => void;
  isPublicMode?: boolean;
  skipFetch?: boolean;
};

export function ChatThreadActions({ isPublicMode = false, onDeleteClick, skipFetch = false, slug, thread }: ChatThreadActionsProps) {
  const t = useTranslations();
  const posthog = usePostHog();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === UserRoles.ADMIN;
  const isDesktop = useMediaQuery('(min-width: 768px)', true);
  const toggleFavoriteMutation = useToggleFavoriteMutation();
  const togglePublicMutation = useTogglePublicMutation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);

  const { data: cachedThreadData } = useThreadQuery(thread.id, !isPublicMode && !skipFetch);

  // Extract thread metadata from cache (source of truth after mutations)
  const cachedThread = cachedThreadData?.success ? cachedThreadData.data.thread : null;

  const threadIsPublic = cachedThread?.isPublic ?? thread.isPublic;
  const threadIsFavorite = cachedThread?.isFavorite ?? thread.isFavorite ?? false;

  const { isBusy, storeThreadId, storeThreadTitle } = useChatStore(useShallow(s => ({
    // Derive streaming state from phase (source of truth)
    isBusy: (s.phase !== ChatPhases.IDLE && s.phase !== ChatPhases.COMPLETE)
      || (s.phase === ChatPhases.IDLE && s.pendingMessage !== null)
      || s.isCreatingThread,
    storeThreadId: s.thread?.id,
    storeThreadTitle: s.thread?.title,
  })));
  const currentTitle = (storeThreadTitle && thread.id === storeThreadId)
    ? storeThreadTitle
    : (thread.title ?? '');

  // Use cached value as source of truth - mutations update cache optimistically
  // Only override with pending state for immediate feedback during this component's mutation
  const displayIsFavorite = toggleFavoriteMutation.isPending && toggleFavoriteMutation.variables
    ? toggleFavoriteMutation.variables.isFavorite
    : threadIsFavorite;

  const displayIsPublic = togglePublicMutation.isPending && togglePublicMutation.variables
    ? togglePublicMutation.variables.isPublic
    : threadIsPublic;

  const shareUrl = `${getAppBaseUrl()}/public/chat/${slug}`;

  // ✅ PROJECT THREADS: Project threads cannot be favorited (no pin support)
  const isProjectThread = thread.projectId !== null && thread.projectId !== undefined;

  // Podcast state for mobile menu (desktop uses PodcastHeaderButton directly)
  // Episodes query is the single source of truth — podcasts are generated per-round.
  const { data: episodesData } = usePodcastEpisodesQuery(isAdmin ? thread.id : '');
  const enablePodcastMutation = useEnablePodcastMutation();

  const { loadPlaylist } = usePodcastStore(
    useShallow(s => ({
      loadPlaylist: s.loadPlaylist,
    })),
  );

  const podcastMenuState = useMemo(() => {
    if (isDesktop || isPublicMode || !isAdmin) {
      return undefined;
    }

    const episodes = episodesData?.success ? episodesData.data : null;
    const generatingEpisode = episodes?.find(ep => ACTIVE_GENERATION_STATUSES.has(ep.status));
    const completedEpisodes = episodes?.filter(ep => ep.status === PodcastStatuses.COMPLETED);

    if (generatingEpisode) {
      return { type: 'generating' as const };
    }

    if (completedEpisodes && completedEpisodes.length > 0) {
      return {
        onListen: () => {
          setIsMenuOpen(false);
          const playlistEpisodes: PodcastEpisode[] = completedEpisodes.map(ep => ({
            audioUrl: getPodcastAudioUrl(ep.threadId, ep.scope, ep.roundNumber ?? undefined),
            isPartial: false,
            podcastId: ep.id,
            roundNumber: ep.roundNumber ?? undefined,
            scriptLines: ep.scriptData?.lines ?? [],
            title: ep.scriptData?.title ?? '',
          }));
          loadPlaylist({ episodes: playlistEpisodes, threadId: thread.id });
        },
        type: 'completed' as const,
      };
    }

    return {
      onEnable: () => {
        setIsMenuOpen(false);
        enablePodcastMutation.mutate({ threadId: thread.id });
      },
      type: 'idle' as const,
    };
  }, [isDesktop, isPublicMode, isAdmin, episodesData, thread, enablePodcastMutation, loadPlaylist]);

  const handleToggleFavorite = () => {
    if (isProjectThread) {
      return;
    }
    const newFavoriteState = !displayIsFavorite;
    toggleFavoriteMutation.mutate({
      isFavorite: newFavoriteState,
      slug,
      threadId: thread.id,
    });

    // Track favorite toggle
    if (newFavoriteState) {
      posthog.capture(ENGAGEMENT_EVENTS.THREAD_FAVORITED, {
        thread_id: thread.id,
      });
    }
  };

  const handleMakePublic = () => {
    if (threadIsPublic || togglePublicMutation.isPending) {
      return;
    }
    togglePublicMutation.mutate({ isPublic: true, slug, threadId: thread.id });

    // Track thread made public
    posthog.capture(CHAT_UI_EVENTS.THREAD_MADE_PUBLIC, {
      thread_id: thread.id,
    });
    posthog.capture(ENGAGEMENT_EVENTS.THREAD_SHARED, {
      thread_id: thread.id,
    });
  };

  const handleMakePrivate = () => {
    if (!threadIsPublic || togglePublicMutation.isPending) {
      setIsShareDialogOpen(false);
      return;
    }
    setIsShareDialogOpen(false);
    togglePublicMutation.mutate({ isPublic: false, slug, threadId: thread.id });

    // Track thread made private
    posthog.capture(CHAT_UI_EVENTS.THREAD_MADE_PRIVATE, {
      thread_id: thread.id,
    });
  };

  const handleShareDialogOpenChange = (open: boolean) => {
    if (!open && togglePublicMutation.isPending) {
      return;
    }
    setIsShareDialogOpen(open);
  };

  const handleOpenShareDialog = () => {
    setIsMenuOpen(false);
    setIsShareDialogOpen(true);

    // Track share dialog opened
    posthog.capture(CHAT_UI_EVENTS.SHARE_DIALOG_OPENED, {
      is_public: displayIsPublic,
      thread_id: thread.id,
    });
  };

  const handleOpenRenameDialog = () => {
    setIsMenuOpen(false);
    setIsRenameDialogOpen(true);
  };

  if (isPublicMode) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          {displayIsPublic && (
            <SocialShareButton
              url={shareUrl}
              showTextOnLargeScreens={isPublicMode}
            />
          )}
        </div>
      </TooltipProvider>
    );
  }

  if (isDesktop) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-2">
          {displayIsPublic && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
              <Icons.globe className="size-3.5" />
              <span className="text-xs font-medium">{t('chat.shareDialog.publicStatus')}</span>
            </div>
          )}

          <Tooltip delayDuration={800}>
            <TooltipTrigger asChild>
              <Button
                variant={ComponentVariants.GHOST}
                size={ComponentSizes.SM}
                aria-label={t('chat.share')}
                onClick={handleOpenShareDialog}
                disabled={togglePublicMutation.isPending || isBusy}
                loading={togglePublicMutation.isPending}
                startIcon={<Icons.share />}
              >
                {t('chat.share')}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-sm">{isBusy ? t('chat.waitForStreamingToComplete') : t('chat.share')}</p>
            </TooltipContent>
          </Tooltip>

          {isAdmin && (
            <PodcastHeaderButton
              threadId={thread.id}
              disabled={isBusy}
            />
          )}

          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={ComponentVariants.GHOST}
                size={ComponentSizes.ICON}
                aria-label={t('chat.moreOptions')}
                disabled={isBusy}
              >
                <Icons.moreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end">
              <ChatThreadMenuItems
                onRename={handleOpenRenameDialog}
                onPin={isProjectThread ? undefined : handleToggleFavorite}
                onDelete={onDeleteClick}
                isFavorite={displayIsFavorite}
                isPinPending={toggleFavoriteMutation.isPending}
              />
            </DropdownMenuContent>
          </DropdownMenu>

          <ShareDialog
            open={isShareDialogOpen}
            onOpenChange={handleShareDialogOpenChange}
            slug={slug}
            threadTitle={currentTitle}
            isPublic={displayIsPublic ?? false}
            isLoading={togglePublicMutation.isPending}
            onMakePublic={handleMakePublic}
            onMakePrivate={handleMakePrivate}
          />

          <ChatRenameDialog
            open={isRenameDialogOpen}
            onOpenChange={setIsRenameDialogOpen}
            threadId={thread.id}
            currentTitle={currentTitle}
          />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {displayIsPublic && (
          <div className="flex items-center gap-1 px-1.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 shrink-0">
            <Icons.globe className="size-3.5" />
            <span className="text-xs font-medium hidden xs:inline">{t('chat.shareDialog.publicStatus')}</span>
          </div>
        )}

        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant={ComponentVariants.GHOST}
              size={ComponentSizes.ICON}
              aria-label={t('moreOptions')}
              disabled={isBusy}
            >
              <Icons.moreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            <ChatThreadMenuItems
              onRename={handleOpenRenameDialog}
              onPin={isProjectThread ? undefined : handleToggleFavorite}
              onShare={handleOpenShareDialog}
              onDelete={onDeleteClick}
              isFavorite={displayIsFavorite}
              isPinPending={toggleFavoriteMutation.isPending}
              podcastState={podcastMenuState}
            />
          </DropdownMenuContent>
        </DropdownMenu>

        <ShareDialog
          open={isShareDialogOpen}
          onOpenChange={handleShareDialogOpenChange}
          slug={slug}
          threadTitle={currentTitle}
          isPublic={displayIsPublic ?? false}
          isLoading={togglePublicMutation.isPending}
          onMakePublic={handleMakePublic}
          onMakePrivate={handleMakePrivate}
        />

        <ChatRenameDialog
          open={isRenameDialogOpen}
          onOpenChange={setIsRenameDialogOpen}
          threadId={thread.id}
          currentTitle={currentTitle}
        />
      </div>
    </TooltipProvider>
  );
}
