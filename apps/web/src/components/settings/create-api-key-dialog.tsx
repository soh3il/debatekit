import { API_KEY_LIMITS } from '@debatekit/shared/constants';
import { useRef, useState } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateApiKeyMutation } from '@/hooks';
import { useCopyToClipboard } from '@/hooks/utils/use-copy-to-clipboard';
import { AnalyticsEvents, DiscoverableFeatures, useAnalytics } from '@/lib/analytics';
import { useTranslations } from '@/lib/i18n';

const EXPIRY_OPTIONS = [
  { label: 'expiresIn.never', value: 'never' },
  { label: 'expiresIn.30days', value: '30' },
  { label: 'expiresIn.90days', value: '90' },
  { label: 'expiresIn.1year', value: '365' },
] as const;

type CreateApiKeyDialogProps = {
  defaultName?: string;
  onKeyCreated: (keyValue: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function CreateApiKeyDialog({ defaultName, onKeyCreated, onOpenChange, open }: CreateApiKeyDialogProps) {
  const t = useTranslations('apiKeys.form');
  const { track, trackFeatureDiscovery } = useAnalytics();
  const createMutation = useCreateApiKeyMutation();
  const [createdKeyValue, setCreatedKeyValue] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [name, setName] = useState('');

  // Pre-fill name when dialog opens with a suggested name (e.g. from MCP platform click)
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current && defaultName && !createdKeyValue) {
    setName(defaultName);
  }
  prevOpenRef.current = open;

  const { copied, copy } = useCopyToClipboard({
    messages: {
      errorTitle: t('copyError'),
      successTitle: t('copySuccess'),
    },
  });

  const resetForm = () => {
    setCreatedKeyValue(null);
    setExpiresIn('never');
    setName('');
    createMutation.reset();
  };

  const handleCreate = () => {
    if (name.length < 3) {
      return;
    }

    const expiresInDays = expiresIn === 'never' ? undefined : Number(expiresIn);

    createMutation.mutate(
      {
        json: {
          expiresIn: expiresInDays,
          name,
        },
      },
      {
        onSuccess: (result) => {
          const keyValue = result?.data?.apiKey?.key;
          if (keyValue) {
            setCreatedKeyValue(keyValue);
            track(AnalyticsEvents.MCP_API_KEY_CREATED, {
              expires_in: expiresIn === 'never' ? 'never' : `${expiresIn}d`,
              has_custom_name: name.length > 0,
            });
            trackFeatureDiscovery(DiscoverableFeatures.MCP_API_KEYS, 'create_api_key_dialog');
          }
        },
      },
    );
  };

  const handleClose = () => {
    if (createdKeyValue) {
      onKeyCreated(createdKeyValue);
    }
    resetForm();
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleClose();
      return;
    }
    onOpenChange(nextOpen);
  };

  if (createdKeyValue) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icons.checkCircle className="size-5 text-emerald-500" />
              {t('successTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Warning banner */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-sm text-amber-400">
                {t('copyWarning')}
              </p>
            </div>

            {/* Key display */}
            <div className="rounded-lg bg-muted/50 px-4 py-3 font-mono text-sm break-all">
              {createdKeyValue}
            </div>

            {/* Copy button */}
            <Button
              variant="glass"
              className="w-full"
              onClick={() => copy(createdKeyValue)}
              startIcon={copied
                ? <Icons.check className="size-4 text-emerald-500" />
                : <Icons.copy className="size-4" />}
            >
              {copied ? t('copied') : t('copyButton')}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>
              {t('doneButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.key className="size-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="api-key-name">{t('nameLabel')}</Label>
            <Input
              id="api-key-name"
              autoFocus
              maxLength={50}
              minLength={3}
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate();
                }
              }}
            />
            {name.length > 0 && name.length < 3 && (
              <p className="text-xs text-muted-foreground">
                {t('nameMinLength')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key-expiry">{t('expiresInLabel')}</Label>
            <Select value={expiresIn} onValueChange={setExpiresIn}>
              <SelectTrigger id="api-key-expiry" className="w-full">
                <SelectValue placeholder={t('expiresInPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {createMutation.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
            <p className="text-sm font-medium text-destructive">{t('limitReached.title')}</p>
            <p className="text-sm text-destructive/80 mt-1">{t('limitReached.description', { max: API_KEY_LIMITS.MAX_KEYS_PER_USER })}</p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={createMutation.isPending}
            onClick={() => handleOpenChange(false)}
          >
            {t('cancelButton')}
          </Button>
          <Button
            disabled={name.length < 3 || createMutation.isPending}
            loading={createMutation.isPending}
            loadingText={t('creating')}
            onClick={handleCreate}
          >
            {t('createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
