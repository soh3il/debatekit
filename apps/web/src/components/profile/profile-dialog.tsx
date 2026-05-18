import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from '@/lib/i18n';
import dynamic from '@/lib/utils/dynamic';

import type { NotificationsTabContentProps } from './notifications-tab-content';

const ProfileTabContent = dynamic<object>(
  () => import('./profile-tab-content').then(m => ({ default: m.ProfileTabContent })),
  { ssr: false },
);

const NotificationsTabContent = dynamic<NotificationsTabContentProps>(
  () => import('./notifications-tab-content').then(m => ({ default: m.NotificationsTabContent })),
  { ssr: false },
);

const AccountTabContent = dynamic<object>(
  () => import('./account-tab-content').then(m => ({ default: m.AccountTabContent })),
  { ssr: false },
);

// ── Props ────────────────────────────────────────────────────────

export type ProfileDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

// ── Component ────────────────────────────────────────────────────

export function ProfileDialog({ onOpenChange, open }: ProfileDialogProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-[540px] h-[min(600px,85vh)] !overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('profileDialog.title')}</DialogTitle>
          <DialogDescription>{t('profileDialog.description')}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="profile">
              {t('profileDialog.tabs.profile')}
            </TabsTrigger>
            <TabsTrigger value="notifications">
              {t('profileDialog.tabs.notifications')}
            </TabsTrigger>
            <TabsTrigger value="account">
              {t('profileDialog.tabs.account')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="flex-1 min-h-0 flex flex-col mt-4">
            <ProfileTabContent />
          </TabsContent>

          <TabsContent value="notifications" className="flex-1 min-h-0 flex flex-col mt-4">
            <NotificationsTabContent />
          </TabsContent>

          <TabsContent value="account" className="flex-1 min-h-0 flex flex-col mt-4">
            <AccountTabContent />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
