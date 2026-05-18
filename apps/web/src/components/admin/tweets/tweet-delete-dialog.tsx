import { ConfirmationDialogVariants } from '@debatekit/shared';

import { ConfirmationDialog } from '@/components/chat/confirmation-dialog';
import { Icons } from '@/components/icons';
import { useDeleteTweetMutation } from '@/hooks/mutations';
import { useTranslations } from '@/lib/i18n';
import { toastManager } from '@/lib/toast';
import type { ScheduledTweet } from '@/services/api';

type TweetDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tweet: ScheduledTweet | null;
};

export function TweetDeleteDialog({ onOpenChange, open, tweet }: TweetDeleteDialogProps) {
  const t = useTranslations();
  const deleteMutation = useDeleteTweetMutation();

  const handleConfirm = () => {
    if (!tweet) {
      return;
    }

    deleteMutation.mutate(
      { param: { id: tweet.id } },
      {
        onError: () => {
          toastManager.error(t('admin.tweets.deleteError'));
        },
        onSuccess: () => {
          toastManager.success(t('admin.tweets.deleted'));
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('admin.tweets.deleteConfirmTitle')}
      description={t('admin.tweets.deleteConfirmDescription')}
      icon={<Icons.trash className="size-5 text-destructive" />}
      confirmText={t('actions.delete')}
      confirmingText={t('actions.deleting')}
      cancelText={t('actions.cancel')}
      isLoading={deleteMutation.isPending}
      variant={ConfirmationDialogVariants.DESTRUCTIVE}
      onConfirm={handleConfirm}
    />
  );
}
