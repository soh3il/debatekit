import type { EmailCategory } from '@debatekit/shared/enums';
import { EMAIL_CATEGORIES, EmailCategorySchema } from '@debatekit/shared/enums';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { Icon } from '@/components/icons';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useEmailPreferencesQuery, useUpdateEmailPreferencesMutation } from '@/hooks';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui/cn';

// ── Form Schema ──────────────────────────────────────────────────

const EmailPreferencesFormSchema = z.object({
  activity: z.boolean(),
  globalUnsubscribe: z.boolean(),
  marketing: z.boolean(),
  newsletter: z.boolean(),
  product_updates: z.boolean(),
  tips: z.boolean(),
});

type EmailPreferencesFormValues = z.infer<typeof EmailPreferencesFormSchema>;

// ── Category Icons (enum-based lookup) ───────────────────────────

const CATEGORY_ICONS: Record<EmailCategory, Icon> = {
  activity: Icons.zap,
  marketing: Icons.sparkles,
  newsletter: Icons.mail,
  product_updates: Icons.gift,
  tips: Icons.lightbulb,
};

// ── Skeleton ─────────────────────────────────────────────────────

function NotificationsTabSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 space-y-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-[68px] w-full rounded-lg" />
        <Skeleton className="h-px w-full" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────

export type NotificationsTabContentProps = {
  onSaved?: () => void;
};

// ── Component ────────────────────────────────────────────────────

export function NotificationsTabContent({ onSaved }: NotificationsTabContentProps) {
  const t = useTranslations('emailPreferences');
  const { data, isPending: isQueryPending } = useEmailPreferencesQuery();
  const updateMutation = useUpdateEmailPreferencesMutation();

  const form = useForm<EmailPreferencesFormValues>({
    defaultValues: {
      activity: true,
      globalUnsubscribe: false,
      marketing: true,
      newsletter: true,
      product_updates: true,
      tips: true,
    },
    resolver: zodResolver(EmailPreferencesFormSchema),
  });

  const globalUnsubscribe = form.watch('globalUnsubscribe');

  // Reset form when data loads
  useEffect(() => {
    if (!data?.success || !data.data?.preferences) {
      return;
    }

    const prefs = data.data.preferences;
    const values: Partial<EmailPreferencesFormValues> = {
      globalUnsubscribe: prefs.some(p => p.globalUnsubscribe),
    };

    for (const pref of prefs) {
      const parsed = EmailCategorySchema.safeParse(pref.category);
      if (parsed.success) {
        values[parsed.data] = pref.subscribed;
      }
    }

    form.reset({ ...form.getValues(), ...values }, { keepDirty: false });
  }, [data, form]);

  const handleSubmit = async (values: EmailPreferencesFormValues) => {
    const preferences = EMAIL_CATEGORIES.map(category => ({
      category,
      subscribed: values.globalUnsubscribe ? false : values[category],
    }));

    await updateMutation.mutateAsync({
      json: { preferences },
    });

    onSaved?.();
  };

  if (isQueryPending) {
    return <NotificationsTabSkeleton />;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-4 pb-2">
            <p className="text-sm text-muted-foreground">
              {t('description')}
            </p>

            {/* Global Unsubscribe Toggle */}
            <FormField
              control={form.control}
              name="globalUnsubscribe"
              render={({ field }) => (
                <FormItem
                  className={cn(
                    'flex flex-row items-center justify-between gap-4 rounded-lg border p-4 transition-colors',
                    field.value && 'border-destructive/20 bg-destructive/5',
                  )}
                >
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">
                      {t('globalUnsubscribe')}
                    </FormLabel>
                    <FormDescription className="text-xs">
                      {field.value
                        ? t('globalUnsubscribeWarning')
                        : t('globalUnsubscribeDescription')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            {/* Category Toggles — enum-based i18n keys */}
            <div
              className={cn(
                'space-y-3 transition-opacity',
                globalUnsubscribe && 'opacity-50 pointer-events-none',
              )}
            >
              {EMAIL_CATEGORIES.map((category) => {
                const CategoryIcon = CATEGORY_ICONS[category];

                return (
                  <FormField
                    key={category}
                    control={form.control}
                    name={category}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                          <CategoryIcon className="size-4 shrink-0 text-muted-foreground" />
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm font-medium">
                              {t(`categories.${category}.label`)}
                            </FormLabel>
                            <FormDescription className="text-xs">
                              {t(`categories.${category}.description`)}
                            </FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter bordered bleed={false}>
          <Button
            type="submit"
            disabled={!form.formState.isDirty || updateMutation.isPending}
            loading={updateMutation.isPending}
            loadingText={t('saving')}
          >
            {t('save')}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
