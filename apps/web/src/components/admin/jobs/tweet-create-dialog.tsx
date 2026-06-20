import { TweetSources } from '@debatekit/shared/enums';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
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
  RHFTextarea,
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
import { useCreateTweetMutation } from '@/hooks/mutations';
import { useTranslations } from '@/lib/i18n';
import { toastManager } from '@/lib/toast';
import { cn } from '@/lib/ui/cn';

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

function createTweetFormSchema(t: (key: string) => string) {
  return z.object({
    content: z
      .string()
      .min(1, t('admin.tweets.new.contentRequired'))
      .max(25000, t('admin.tweets.new.contentMax')),
    scheduledAt: z.string().datetime().optional().or(z.literal('')),
  });
}

type TweetFormValues = z.infer<ReturnType<typeof createTweetFormSchema>>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type TweetCreateDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TweetCreateDialog({ onOpenChange, open }: TweetCreateDialogProps) {
  const t = useTranslations();
  const createMutation = useCreateTweetMutation();

  const translatedSchema = useMemo(() => createTweetFormSchema(t), [t]);

  const form = useForm<TweetFormValues>({
    defaultValues: {
      content: '',
      scheduledAt: '',
    },
    resolver: zodResolver(translatedSchema),
  });

  const contentLength = form.watch('content').length;
  const isNearLimit = contentLength > 23000;
  const isOverLimit = contentLength > 25000;

  const onSubmit = (data: TweetFormValues) => {
    createMutation.mutate(
      {
        json: {
          content: data.content,
          scheduledAt: data.scheduledAt || undefined,
          source: TweetSources.MANUAL,
        },
      },
      {
        onSuccess: (response) => {
          if (response.success) {
            toastManager.success(t('admin.tweets.created'));
            form.reset();
            onOpenChange(false);
          }
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
            <Icons.twitter className="size-5" />
            {t('admin.tweets.new.title')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.tweets.new.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <RHFTextarea
                name="content"
                title={t('admin.tweets.new.contentLabel')}
                placeholder={t('admin.tweets.new.contentPlaceholder')}
                rows={4}
              />
              <div className="flex items-center justify-end mt-1.5">
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    isOverLimit && 'text-destructive font-medium',
                    isNearLimit && !isOverLimit && 'text-amber-500',
                    !isNearLimit && 'text-muted-foreground',
                  )}
                >
                  {contentLength}
                  /25000
                </span>
              </div>
            </div>

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
                  <FormDescription className="text-xs">
                    {t('admin.tweets.new.scheduledAtHint')}
                  </FormDescription>
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
                disabled={createMutation.isPending}
                loading={createMutation.isPending}
                startIcon={<Icons.twitter />}
              >
                {t('admin.tweets.new.submit')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
