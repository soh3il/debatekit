import { Icons } from '@/components/icons';
import { NotificationsTabContent } from '@/components/profile/notifications-tab-content';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslations } from '@/lib/i18n';

// ── Props ────────────────────────────────────────────────────────

export type EmailPreferencesModalProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

// ── Component ────────────────────────────────────────────────────

export function EmailPreferencesModal({ onOpenChange, open }: EmailPreferencesModalProps) {
  const t = useTranslations('emailPreferences');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.mail className="size-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <NotificationsTabContent onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
