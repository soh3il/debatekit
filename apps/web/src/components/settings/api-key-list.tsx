import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApiKeysQuery, useDeleteApiKeyMutation } from '@/hooks';
import { AnalyticsEvents, useAnalytics } from '@/lib/analytics';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui/cn';

export function ApiKeyList() {
  const t = useTranslations('settings.apiKeys.list');
  const { track } = useAnalytics();
  const { data, isPending } = useApiKeysQuery();
  const deleteMutation = useDeleteApiKeyMutation();

  const apiKeys = data?.data?.items ?? [];

  const handleDelete = (keyId: string) => {
    deleteMutation.mutate(
      { param: { keyId } },
      {
        onSuccess: () => {
          track(AnalyticsEvents.MCP_API_KEY_DELETED, { remaining_keys: apiKeys.length - 1 });
        },
      },
    );
  };

  return (
    <div className="flex flex-col">
      {isPending
        ? (
            <div className="flex items-center justify-center py-8">
              <Icons.loader className="size-5 animate-spin text-muted-foreground" />
            </div>
          )
        : apiKeys.length === 0
          ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {t('empty')}
                </p>
              </div>
            )
          : (
              <div className="space-y-2">
                {apiKeys.map(key => (
                  <div
                    key={key.id}
                    className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3.5 py-3 sm:px-3 sm:py-2.5 transition-colors hover:bg-white/[0.04]"
                  >
                    <Icons.key className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {key.name || t('unnamedKey')}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0.5',
                            key.enabled
                              ? 'text-emerald-400 border-emerald-500/30'
                              : 'text-muted-foreground border-muted-foreground/30',
                          )}
                        >
                          {key.enabled ? t('enabled') : t('disabled')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('created')}
                        {' '}
                        {new Date(key.createdAt).toLocaleDateString()}
                        {' '}
                        &middot;
                        {' '}
                        {t('expires')}
                        {' '}
                        {key.expiresAt
                          ? new Date(key.expiresAt).toLocaleDateString()
                          : t('never')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(key.id)}
                      disabled={deleteMutation.isPending}
                      title={t('deleteTitle')}
                      className="shrink-0 size-9 sm:size-8"
                    >
                      <Icons.trash className="size-3.5 text-destructive/70" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
    </div>
  );
}
