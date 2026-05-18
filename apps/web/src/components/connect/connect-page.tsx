import { Link } from '@tanstack/react-router';
import { z } from 'zod';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/ui/cn';

// Integration status enum (5-part pattern)
export const INTEGRATION_STATUS_VALUES = ['live', 'coming-soon'] as const;
export const DEFAULT_INTEGRATION_STATUS: IntegrationStatus = 'coming-soon';
export const IntegrationStatusSchema = z.enum(INTEGRATION_STATUS_VALUES);
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;
export const IntegrationStatuses = { COMING_SOON: 'coming-soon', LIVE: 'live' } as const;

export const IntegrationSchema = z.object({
  icon: z.string(),
  internal: z.boolean().optional(),
  key: z.string(),
  status: IntegrationStatusSchema,
  url: z.string().optional(),
});

export type Integration = z.infer<typeof IntegrationSchema>;

const INTEGRATIONS = IntegrationSchema.array().parse([
  {
    icon: 'openai',
    key: 'chatgpt',
    status: 'live',
    url: 'https://chatgpt.com/g/g-69af4ee48f388191a0e92a24151e788e-debatekit',
  },
  {
    icon: 'slack',
    key: 'slack',
    status: 'live',
    url: 'https://slack.com/marketplace/A0AKJRQ6ZTP-debatekit',
  },
  {
    icon: 'telegram',
    key: 'telegram',
    status: 'live',
    url: 'https://t.me/debatekitnowbot',
  },
  {
    icon: 'zapier',
    key: 'zapier',
    status: 'live',
    url: 'https://zapier.com/developer/public-invite/237707/e5c297aeb14dc886a0c491b2e609954c/',
  },
  {
    icon: 'n8n',
    key: 'n8n',
    status: 'live',
    url: 'https://www.npmjs.com/package/n8n-nodes-debatekit-ai',
  },
  {
    icon: 'code',
    internal: true,
    key: 'apiKeys',
    status: 'live',
    url: '/chat/settings/api-keys',
  },
  {
    icon: 'mcp',
    key: 'mcpRegistry',
    status: 'live',
    url: 'https://registry.modelcontextprotocol.io/v0.1/servers/now.debatekit.mcp%2Fdebatekit/versions/latest',
  },
  {
    icon: 'smithery',
    key: 'smithery',
    status: 'live',
    url: 'https://smithery.ai/servers/debatekit/debatekit',
  },
  {
    icon: 'cursor',
    key: 'cursorDirectory',
    status: 'live',
    url: 'https://cursor.directory/mcp/debatekit',
  },
  { icon: 'raycast', key: 'raycast', status: 'coming-soon' },
  { icon: 'pipedream', key: 'pipedream', status: 'coming-soon' },
  { icon: 'crewai', key: 'crewai', status: 'coming-soon' },
  { icon: 'dify', key: 'dify', status: 'coming-soon' },
  { icon: 'huggingface', key: 'huggingface', status: 'coming-soon' },
]);

export function ConnectPage() {
  const t = useTranslations();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t('connect.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t('connect.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map(integration => (
          <IntegrationCard key={integration.key} integration={integration} />
        ))}
      </div>
    </div>
  );
}

type IconName = keyof typeof Icons;

const ICON_NAMES = new Set<string>(Object.keys(Icons));

function isIconName(name: string): name is IconName {
  return ICON_NAMES.has(name);
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const t = useTranslations();
  const isLive = integration.status === IntegrationStatuses.LIVE;
  const IconComp = isIconName(integration.icon) ? Icons[integration.icon] : null;

  const name = t(`connect.${integration.key}.name`);
  const description = t(`connect.${integration.key}.description`);

  const card = (
    <div
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border p-4 transition-colors',
        isLive
          ? 'bg-card hover:bg-accent/50'
          : 'opacity-50 cursor-default',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          {IconComp && <IconComp className="size-5" />}
        </div>
        {!isLive && (
          <Badge variant="secondary" className="text-[10px]">
            {t('connect.statusComingSoon')}
          </Badge>
        )}
      </div>

      <div className="flex-1">
        <p className="font-semibold text-sm">{name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      {isLive && integration.url && (
        <div className="pt-1">
          {integration.internal
            ? (
                <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                  <Link to={integration.url} preload="intent">
                    {t(`connect.${integration.key}.action`)}
                    <Icons.arrowRight className="size-3" />
                  </Link>
                </Button>
              )
            : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => window.open(integration.url, '_blank', 'noopener,noreferrer')}
                >
                  {t(`connect.${integration.key}.action`)}
                  <Icons.externalLink className="size-3" />
                </Button>
              )}
        </div>
      )}
    </div>
  );

  return card;
}
