import { zodResolver } from '@hookform/resolvers/zod';
import { TweetSources } from '@debatekit/shared/enums';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Form,
  FormControl,
  FormDescription,
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
import { useCreateTweetMutation } from '@/hooks/mutations';
import { useTranslations } from '@/lib/i18n';
import { toastManager } from '@/lib/toast';

import { TweetCharacterCount } from './tweet-character-count';

type TweetCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const createTweetFormSchema = z.object({
  content: z.string().min(1).max(25000),
  scheduledAt: z.string().optional(),
  threadId: z.string().optional(),
});

type CreateTweetFormValues = z.infer<typeof createTweetFormSchema>;

/** Return next occurrence of a given hour (local time) as ISO string */
function getNextTimeSlot(hour: number) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target.toISOString().slice(0, 16); // For datetime-local input
}

export function TweetCreateDialog({ onOpenChange, open }: TweetCreateDialogProps) {
  const t = useTranslations();
  const createMutation = useCreateTweetMutation();
  const [scheduleMode, setScheduleMode] = useState<'draft' | 'schedule'>('draft');

  const form = useForm<CreateTweetFormValues>({
    defaultValues: {
      content: '',
      scheduledAt: '',
      threadId: '',
    },
    resolver: zodResolver(createTweetFormSchema),
  });

  const contentValue = form.watch('content');
  const charCount = contentValue?.length ?? 0;

  const onSubmit = (data: CreateTweetFormValues) => {
    const json: { content: string; scheduledAt?: string; source: typeof TweetSources.MANUAL; threadId?: string } = {
      content: data.content,
      source: TweetSources.MANUAL,
    };

    if (scheduleMode === 'schedule' && data.scheduledAt) {
      json.scheduledAt = new Date(data.scheduledAt).toISOString();
    }

    if (data.threadId) {
      json.threadId = data.threadId;
    }

    createMutation.mutate(
      { json },
      {
        onSuccess: () => {
          toastManager.success(t('admin.tweets.created'));
          form.reset();
          setScheduleMode('draft');
          onOpenChange(false);
        },
      },
    );
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
      setScheduleMode('draft');
    }
    onOpenChange(isOpen);
  };

  const handleQuickSchedule = (hour: number) => {
    form.setValue('scheduledAt', getNextTimeSlot(hour));
    setScheduleMode('schedule');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.twitter className="size-5" />
            {t('admin.tweets.new.title')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.tweets.new.description')}
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
                      placeholder={t('admin.tweets.new.contentPlaceholder')}
                      className="min-h-28 resize-none"
                      maxLength={25000}
                      {...field}
                    />
                  </FormControl>
                  <div className="flex items-center justify-between">
                    <FormDescription className="text-xs">
                      {t('admin.tweets.new.contentHint')}
                    </FormDescription>
                    <TweetCharacterCount count={charCount} />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="threadId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.tweets.new.threadIdLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('admin.tweets.new.threadIdPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    {t('admin.tweets.new.threadIdHint')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Schedule section */}
            <div className="space-y-3">
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
                        onChange={(e) => {
                          field.onChange(e);
                          if (e.target.value) {
                            setScheduleMode('schedule');
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quick schedule buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSchedule(8)}
                  className="text-xs"
                >
                  <Icons.clock className="size-3 mr-1" />
                  {t('admin.tweets.new.quickMorning')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSchedule(12)}
                  className="text-xs"
                >
                  <Icons.clock className="size-3 mr-1" />
                  {t('admin.tweets.new.quickLunch')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSchedule(18)}
                  className="text-xs"
                >
                  <Icons.clock className="size-3 mr-1" />
                  {t('admin.tweets.new.quickEvening')}
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {t('actions.cancel')}
              </Button>
              {scheduleMode === 'schedule' && form.getValues('scheduledAt')
                ? (
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      loading={createMutation.isPending}
                      startIcon={<Icons.clock />}
                    >
                      {t('admin.tweets.new.schedule')}
                    </Button>
                  )
                : (
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      loading={createMutation.isPending}
                      startIcon={<Icons.pencil />}
                    >
                      {t('admin.tweets.new.saveAsDraft')}
                    </Button>
                  )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
