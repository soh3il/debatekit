import { useQueryClient } from '@tanstack/react-query';

import type { DeleteAccountDialogProps } from '@/components/chat/delete-account-dialog';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useBoolean } from '@/hooks/utils';
import { AnalyticsEvents, useAnalytics } from '@/lib/analytics';
import { deleteUser, signOut } from '@/lib/auth/client';
import { getAppBaseUrl } from '@/lib/config/base-urls';
import { clearServiceWorkerCache, invalidateUserQueries } from '@/lib/data/cache';
import { useTranslations } from '@/lib/i18n';
import { showApiErrorToast } from '@/lib/toast';
import dynamic from '@/lib/utils/dynamic';
import { clearOwnCacheService } from '@/services/api';

const DeleteAccountDialog = dynamic<DeleteAccountDialogProps>(
  () => import('@/components/chat/delete-account-dialog').then(m => ({ default: m.DeleteAccountDialog })),
  { ssr: false },
);

// ── Component ────────────────────────────────────────────────────

export function AccountTabContent() {
  const t = useTranslations();
  const { track } = useAnalytics();
  const queryClient = useQueryClient();
  const showDeleteDialog = useBoolean(false);
  const isDeleting = useBoolean(false);

  const handleDeleteAccount = async () => {
    track(AnalyticsEvents.DELETE_ACCOUNT_CONFIRMED);
    isDeleting.onTrue();
    try {
      try {
        await clearOwnCacheService();
      } catch { /* ignore */ }

      const appBaseUrl = getAppBaseUrl();
      await deleteUser({ callbackURL: `${appBaseUrl}/auth/sign-in` });

      await signOut({
        fetchOptions: {
          onSuccess: () => {
            invalidateUserQueries(queryClient);
            clearServiceWorkerCache();
            window.location.href = '/auth/sign-in';
          },
        },
      });
    } catch (error) {
      showApiErrorToast(t('profileDialog.account.deleteAccountFailed'), error);
      isDeleting.onFalse();
      showDeleteDialog.onFalse();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="space-y-6 pb-2">
          {/* Danger Zone */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Icons.alertTriangle className="size-4 text-destructive" />
              <h3 className="text-sm font-medium text-destructive">{t('profileDialog.account.dangerZone')}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('profileDialog.account.dangerZoneDescription')}
            </p>

            <div className="rounded-lg border border-destructive/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('profileDialog.account.deleteAccount')}</p>
                  <p className="text-xs text-muted-foreground">{t('profileDialog.account.deleteAccountDescription')}</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    track(AnalyticsEvents.DELETE_ACCOUNT_INITIATED);
                    showDeleteDialog.onTrue();
                  }}
                >
                  <Icons.trash className="size-4" />
                  {t('userMenu.deleteAccount')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDeleteDialog.value && (
        <DeleteAccountDialog
          open={showDeleteDialog.value}
          onOpenChange={showDeleteDialog.setValue}
          onConfirm={handleDeleteAccount}
          isProcessing={isDeleting.value}
        />
      )}
    </div>
  );
}
