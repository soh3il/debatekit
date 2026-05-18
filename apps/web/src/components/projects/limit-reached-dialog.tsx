'use client';

import { Link } from '@tanstack/react-router';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslations } from '@/lib/i18n';

const LimitReasons = {
  ANONYMOUS: 'anonymous',
  FREE_TIER: 'free-tier',
  PRO_LIMIT: 'pro-limit',
} as const;

type LimitReason = (typeof LimitReasons)[keyof typeof LimitReasons];
const DEFAULT_LIMIT_REASON: LimitReason = 'pro-limit';

type LimitReachedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'project' | 'thread';
  max: number;
  reason?: LimitReason;
};

export function LimitReachedDialog({
  max,
  onOpenChange,
  open,
  reason = DEFAULT_LIMIT_REASON,
  type,
}: LimitReachedDialogProps) {
  const t = useTranslations();

  // Anonymous: sign-up CTA
  if (type === 'project' && reason === LimitReasons.ANONYMOUS) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icons.sparkles className="size-5 text-muted-foreground" />
              {t('projects.signUpTitle')}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              {t('projects.signUpDescription')}
            </p>
          </DialogBody>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('actions.close')}
            </Button>
            <Button asChild variant="white">
              <Link to="/auth/sign-in">
                {t('anonymous.signUpFree')}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Free tier: upgrade CTA
  if (type === 'project' && reason === LimitReasons.FREE_TIER) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icons.sparkles className="size-5 text-muted-foreground" />
              {t('projects.upgradeTitle')}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              {t('projects.upgradeDescription')}
            </p>
          </DialogBody>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('actions.close')}
            </Button>
            <Button asChild variant="upgrade" size="sm">
              <Link to="/chat/pricing" onClick={() => onOpenChange(false)}>
                {t('userMenu.upgradeToPro')}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Pro at limit (default): existing behavior
  const title = type === 'project'
    ? t('projects.limitReached')
    : t('projects.threadLimitReached');

  const description = type === 'project'
    ? t('projects.limitReachedDescription', { max })
    : t('projects.threadLimitReachedDescription', { max });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.alertCircle className="size-5 text-muted-foreground" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </DialogBody>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {t('actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
