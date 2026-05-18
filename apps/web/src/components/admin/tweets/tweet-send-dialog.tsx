import { ConfirmationDialogVariants } from '@debatekit/shared';

import { ConfirmationDialog } from '@/components/chat/confirmation-dialog';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { useSendTweetMutation } from '@/hooks/mutations';
import { useTranslations } from '@/lib/i18n';
import { toastManager } from '@/lib/toast';
import type { ScheduledTweet } from '@/services/api';

type TweetSendDialogProps = {
  tweet: ScheduledTweet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TweetSendDialog({ onOpenChange, open, tweet }: TweetSendDialogProps) {
  const t = useTranslations();
  const sendMutation = useSendTweetMutation();

  const handleConfirm = () => {
    if (!tweet) {
      return;
    }

    sendMutation.mutate(
      { param: { id: tweet.id } },
      {
        onError: () => {
          toastManager.error(t('admin.tweets.sendError'));
        },
        onSuccess: () => {
          toastManager.success(t('admin.tweets.sentSuccess'));
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('admin.tweets.send.title')}
      description={t('admin.tweets.send.description')}
      icon={<Icons.twitter className="size-5 text-primary" />}
      confirmText={t('admin.tweets.send.confirm')}
      confirmingText={t('admin.tweets.send.confirming')}
      cancelText={t('actions.cancel')}
      isLoading={sendMutation.isPending}
      variant={ConfirmationDialogVariants.DEFAULT}
      onConfirm={handleConfirm}
    >
      {tweet && (
        <div className="mt-4 space-y-3">
          {/* Tweet preview */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm whitespace-pre-wrap break-words">{tweet.content}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {t('admin.tweets.charCount', { count: tweet.content.length })}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-amber-500 flex items-center gap-1.5">
            <Icons.alertTriangle className="size-3.5 shrink-0" />
            {t('admin.tweets.send.warning')}
          </p>
        </div>
      )}
    </ConfirmationDialog>
  );
}
