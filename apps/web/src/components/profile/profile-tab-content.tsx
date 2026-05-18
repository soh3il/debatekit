import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormProvider, RHFTextField } from '@/components/forms';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalyticsEvents, useAnalytics } from '@/lib/analytics';
import { updateUser, useSession } from '@/lib/auth/client';
import { formatDate } from '@/lib/format/date';
import { useTranslations } from '@/lib/i18n';
import { showApiErrorToast } from '@/lib/toast';
import { getUserInitials } from '@/lib/utils/get-user-initials';

// ── Schema ───────────────────────────────────────────────────────

const ProfileFormSchema = z.object({
  name: z.string().min(1).max(100),
});

type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

// ── Skeleton ─────────────────────────────────────────────────────

function ProfileTabSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────

export function ProfileTabContent() {
  const t = useTranslations();
  const { track } = useAnalytics();
  const { data: session, isPending } = useSession();
  const user = session?.user;

  const userInitials = useMemo(() => getUserInitials(user), [user]);

  const methods = useForm<ProfileFormValues>({
    defaultValues: {
      name: user?.name || '',
    },
    resolver: zodResolver(ProfileFormSchema),
  });

  const {
    formState: { isDirty, isSubmitting },
    handleSubmit,
  } = methods;

  const handleFormSubmit = async (values: ProfileFormValues) => {
    try {
      await updateUser({ name: values.name });
      track(AnalyticsEvents.PROFILE_UPDATED);
      methods.reset(values);
    } catch (error) {
      showApiErrorToast(t('profileDialog.profile.updateFailed'), error);
    }
  };

  if (isPending) {
    return <ProfileTabSkeleton />;
  }

  const memberSince = user?.createdAt
    ? formatDate(new Date(user.createdAt), { day: undefined, month: 'long', year: 'numeric' })
    : null;

  return (
    <FormProvider methods={methods} onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="space-y-6 pb-2">
          {/* Avatar + Info */}
          <div className="flex items-center gap-4">
            <Avatar className="size-16 rounded-full">
              <AvatarImage
                src={user?.image || undefined}
                alt={user?.name || ''}
                loading="eager"
              />
              <AvatarFallback className="rounded-full text-lg">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="text-sm font-medium">{user?.name || t('user.defaultName')}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              {memberSince && (
                <p className="text-xs text-muted-foreground">
                  {t('profileDialog.profile.memberSince', { date: memberSince })}
                </p>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <RHFTextField<ProfileFormValues>
                name="name"
                title={t('profileDialog.profile.nameLabel')}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                {t('profileDialog.profile.nameDescription')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('profileDialog.profile.emailLabel')}</Label>
              <Input value={user?.email || ''} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">
                {t('profileDialog.profile.emailDescription')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter bordered bleed={false}>
        <Button
          type="submit"
          disabled={!isDirty || isSubmitting}
          loading={isSubmitting}
          loadingText={t('profileDialog.profile.saving')}
        >
          {t('profileDialog.profile.save')}
        </Button>
      </DialogFooter>
    </FormProvider>
  );
}
