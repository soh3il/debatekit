import { DropdownMenuVariants } from '@debatekit/shared';
import { UserRoles } from '@debatekit/shared/enums';

import { Icons } from '@/components/icons';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useIsAnonymous } from '@/hooks/utils/use-is-anonymous';
import { useSession } from '@/lib/auth/client';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui/cn';

type PodcastMenuState
  = { type: 'completed'; onListen: () => void }
    | { type: 'generating' }
    | { type: 'idle'; onEnable: () => void };

type ChatThreadMenuItemsProps = {
  onRename?: () => void;
  onPin?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  isFavorite?: boolean;
  isPinPending?: boolean;
  podcastState?: PodcastMenuState;
};

export function ChatThreadMenuItems({
  isFavorite,
  isPinPending = false,
  onDelete,
  onPin,
  onRename,
  onShare,
  podcastState,
}: ChatThreadMenuItemsProps) {
  const t = useTranslations();
  const tPodcast = useTranslations('podcast');
  const isAnonymous = useIsAnonymous();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === UserRoles.ADMIN;

  return (
    <>
      {onPin && (
        <DropdownMenuItem
          onClick={onPin}
          disabled={isPinPending}
          className={cn(isFavorite && 'text-primary')}
        >
          {isPinPending
            ? <Icons.loader className="size-4 animate-spin" />
            : <Icons.pin className={cn('size-4', isFavorite && 'fill-current')} />}
          {isFavorite
            ? t('chat.unpin')
            : t('chat.pin')}
        </DropdownMenuItem>
      )}
      {onRename && (
        <DropdownMenuItem onClick={onRename}>
          <Icons.pencil className="size-4" />
          {t('chat.rename')}
        </DropdownMenuItem>
      )}
      {onShare && (
        <DropdownMenuItem onClick={onShare}>
          <Icons.share className="size-4" />
          {t('chat.share')}
        </DropdownMenuItem>
      )}
      {isAdmin && podcastState?.type === 'completed' && (
        <DropdownMenuItem onClick={podcastState.onListen}>
          <Icons.headphones className="size-4" />
          {tPodcast('listen')}
        </DropdownMenuItem>
      )}
      {isAdmin && podcastState?.type === 'generating' && (
        <DropdownMenuItem disabled>
          <Icons.loader className="size-4 animate-spin" />
          {tPodcast('generating')}
        </DropdownMenuItem>
      )}
      {isAdmin && podcastState?.type === 'idle' && (
        <DropdownMenuItem onClick={podcastState.onEnable}>
          <Icons.headphones className="size-4" />
          {tPodcast('listen')}
        </DropdownMenuItem>
      )}
      {onDelete && !isAnonymous && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant={DropdownMenuVariants.DESTRUCTIVE} onClick={onDelete}>
            <Icons.trash className="size-4" />
            {t('chat.deleteThread')}
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}
