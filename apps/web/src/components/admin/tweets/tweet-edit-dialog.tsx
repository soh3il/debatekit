import { zodResolver } from '@hookform/resolvers/zod';
import { TWEET_LIMITS } from '@debatekit/shared/constants';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/forms';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateTweetMutation } from '@/hooks/mutations';
import { useTranslations } from '@/lib/i18n';
import { toastManager } from '@/lib/toast';
import type { ScheduledTweet } from '@/services/api';
import type { UpdateTweetParams } from '@/services/api/admin/tweets';

import { TweetCharacterCount } from './tweet-character-count';

type TweetEditDialogProps = {
  tweet: ScheduledTweet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const editTweetSchema = z.object({
  content: z.string().min(TWEET_LIMITS.CONTENT_MIN).max(TWEET_LIMITS.CONTENT_MAX),
  scheduledAt: z.string().optional(),
});

type EditTweetFormValues = z.infer<typeof editTweetSchema>;

/** Format ISO date string for datetime-local input */
function toDatetimeLocalValue(isoString: string | null | undefined) {
  if (!isoString) {
    return '';
  }
  const date = new Date(isoString);
  // datetime-local expects YYYY-MM-DDTHH:mm
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function TweetEditDialog({ onOpenChange, open, tweet }: TweetEditDialogProps) {
  const t = useTranslations();
  const updateMutation = useUpdateTweetMutation();

  const form = useForm<EditTweetFormValues>({
    resolver: zodResolver(editTweetSchema),
    values: tweet
      ? { content: tweet.content, scheduledAt: toDatetimeLocalValue(tweet.scheduledAt) }
      : { content: '', scheduledAt: '' },
  });

  const contentValue = form.watch('content');
  const charCount = contentValue?.length ?? 0;

  if (!tweet) {
    return null;
  }

  const onSubmit = (data: EditTweetFormValues) => {
    const json: UpdateTweetParams['json'] = {};

    if (data.content !== tweet.content) {
      json.content = data.content;
    }

    if (data.scheduledAt) {
      json.scheduledAt = new Date(data.scheduledAt).toISOString();
    } else if (tweet.scheduledAt && !data.scheduledAt) {
      // User cleared the date — move to draft
      json.status = 'draft';
    }

    // Ensure at least one field is being updated
    if (!json.content && !json.scheduledAt && !json.status) {
      toastManager.error(t('admin.tweets.edit.noChanges'));
      return;
    }

    updateMutation.mutate(
      {
        json,
        param: { id: tweet.id },
      },
      {
        onSuccess: () => {
          toastManager.success(t('admin.tweets.updated'));
          onOpenChange(false);
        },
      },
    );
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.pencil className="size-5" />
            {t('admin.tweets.edit.title')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.tweets.edit.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.tweets.new.contentLabel')}</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-28 resize-none"
                      maxLength={TWEET_LIMITS.CONTENT_MAX}
                      {...field}
                    />
                  </FormControl>
                  <div className="flex items-center justify-end">
                    <TweetCharacterCount count={charCount} />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduledAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.tweets.new.scheduledAtLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                loading={updateMutation.isPending}
                startIcon={<Icons.check />}
              >
                {t('actions.save')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
