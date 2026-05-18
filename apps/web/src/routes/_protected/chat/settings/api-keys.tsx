import { API_KEY_LIMITS } from '@debatekit/shared/constants';
import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { PageHeader } from '@/components/chat/chat-header';
import { Icons } from '@/components/icons';
import { ApiKeyList } from '@/components/settings/api-key-list';
import { CreateApiKeyDialog } from '@/components/settings/create-api-key-dialog';
import { McpSetupGuide } from '@/components/settings/mcp-setup-guide';
import { McpUsageHistory } from '@/components/settings/mcp-usage-history';
import { McpUsagePanel, STATUS_DOT_CLASSES } from '@/components/settings/mcp-usage-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useApiKeysQuery } from '@/hooks/queries/api-keys';
import { useMcpHistoryInfiniteQuery } from '@/hooks/queries/mcp';
import { useMcpDashboard } from '@/hooks/queries/use-mcp-dashboard';
import { requireNonAnonymous } from '@/lib/auth';
import {
  apiKeysListQueryOptions,
  mcpCreditsQueryOptions,
  mcpUsageQueryOptions,
} from '@/lib/data/keys';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui/cn';

export const Route = createFileRoute('/_protected/chat/settings/api-keys')({
  beforeLoad: ({ context }) => {
    requireNonAnonymous(context.session);
  },
  component: ApiKeysPage,
  loader: async ({ context }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(apiKeysListQueryOptions),
        context.queryClient.ensureQueryData(mcpCreditsQueryOptions),
        context.queryClient.ensureQueryData(mcpUsageQueryOptions),
      ]);
    } catch {
      // Auth may not be available in SSR context; components fetch client-side as fallback
    }
  },
  staleTime: 0,
});

// ── Accordion Section ────────────────────────────────────────────

type AccordionSectionProps = {
  children: ReactNode;
  id: string;
  onToggle: (id: string) => void;
  open: boolean;
  title: string;
  trailing?: ReactNode;
};

function AccordionSection({
  children,
  id,
  onToggle,
  open,
  title,
  trailing,
}: AccordionSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={() => onToggle(id)}>
      <CollapsibleTrigger className="flex w-full items-center gap-3 py-5 sm:py-6 text-left cursor-pointer group">
        <span className="text-lg sm:text-xl font-semibold tracking-tight flex-1 min-w-0 truncate">
          {title}
        </span>
        {trailing && (
          <span className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            {trailing}
          </span>
        )}
        <Icons.chevronDown
          className={cn(
            'size-5 text-muted-foreground shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-6">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Page ─────────────────────────────────────────────────────────

function ApiKeysPage() {
  const t = useTranslations('settings.apiKeys');
  const tMcp = useTranslations('settings.apiKeys.mcp');
  const tList = useTranslations('settings.apiKeys.list');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [defaultKeyName, setDefaultKeyName] = useState('');
  const [lastCreatedKey, setLastCreatedKey] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set<string>(),
  );

  // Query data for trigger badges
  const { data: dashboardData } = useMcpDashboard();
  const { data: keysData } = useApiKeysQuery();
  const { data: historyData } = useMcpHistoryInfiniteQuery();
  const keyCount = keysData?.data?.items?.length ?? 0;
  const isAtKeyLimit = keyCount >= API_KEY_LIMITS.MAX_KEYS_PER_USER;
  const historyTotal = historyData?.pages[0]?.data.total ?? 0;
  const hasKey = !!lastCreatedKey;

  const handleCreateKey = useCallback((suggestedName?: string) => {
    if (isAtKeyLimit) {
      return;
    }
    setDefaultKeyName(suggestedName ?? '');
    setShowCreateDialog(true);
  }, [isAtKeyLimit]);

  const handleToggle = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 pb-safe min-w-0 overflow-x-hidden">
      <PageHeader
        title={t('title')}
        description={t('description')}
        size="md"
        showSeparator={false}
      />

      {/* Accordion sections */}
      <div className="divide-y divide-white/[0.06]">
        {/* Setup Guide — expanded by default */}
        <AccordionSection
          id="setup-guide"
          open={openSections.has('setup-guide')}
          onToggle={handleToggle}
          title={tMcp('title')}
          trailing={
            hasKey
              ? (
                  <Badge variant="outline" className="text-[11px] text-emerald-400 border-emerald-500/30">
                    {tMcp('keyLoaded')}
                  </Badge>
                )
              : null
          }
        >
          <McpSetupGuide apiKey={lastCreatedKey} onCreateKey={handleCreateKey} />
        </AccordionSection>

        {/* API Keys — expanded by default */}
        <AccordionSection
          id="api-keys"
          open={openSections.has('api-keys')}
          onToggle={handleToggle}
          title={tList('title')}
          trailing={(
            <div className="flex items-center gap-2">
              {keyCount > 0 && (
                <Badge variant="secondary" className="text-[11px]">
                  {keyCount}
                  {' '}
                  {keyCount === 1 ? 'key' : 'keys'}
                </Badge>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="glass"
                      size="sm"
                      className="h-8"
                      disabled={isAtKeyLimit}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateKey();
                      }}
                      startIcon={<Icons.plus className="size-3.5" />}
                    >
                      {tList('createButton')}
                    </Button>
                  </span>
                </TooltipTrigger>
                {isAtKeyLimit && (
                  <TooltipContent>
                    {tList('maxKeysTooltip', { max: API_KEY_LIMITS.MAX_KEYS_PER_USER })}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          )}
        >
          <ApiKeyList />
        </AccordionSection>

        {/* Usage */}
        <AccordionSection
          id="usage"
          open={openSections.has('usage')}
          onToggle={handleToggle}
          title={tMcp('panel.title')}
          trailing={dashboardData
            ? (
                <div className="flex items-center gap-2">
                  <span className={cn('size-2 rounded-full', STATUS_DOT_CLASSES[dashboardData.overallStatus])} />
                  <span className="text-xs text-muted-foreground">
                    {tMcp('panel.summaryRemaining', { percentage: dashboardData.summaryText })}
                  </span>
                  <Badge variant="glass" className="text-[11px]">{dashboardData.planLabel}</Badge>
                </div>
              )
            : null}
        >
          <McpUsagePanel />
        </AccordionSection>

        {/* Recent Activity — collapsed */}
        <AccordionSection
          id="recent-activity"
          open={openSections.has('recent-activity')}
          onToggle={handleToggle}
          title={tMcp('history.title')}
          trailing={
            historyTotal > 0
              ? (
                  <Badge variant="secondary" className="text-[11px]">
                    {historyTotal}
                    {' '}
                    sessions
                  </Badge>
                )
              : null
          }
        >
          <McpUsageHistory />
        </AccordionSection>
      </div>

      <CreateApiKeyDialog
        open={showCreateDialog}
        defaultName={defaultKeyName}
        onOpenChange={setShowCreateDialog}
        onKeyCreated={(keyValue) => {
          setLastCreatedKey(keyValue);
        }}
      />
    </div>
  );
}
