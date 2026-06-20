'use client';

import { usePostHog } from 'posthog-js/react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getMcpBaseUrl } from '@/lib/config/base-urls';
import type { McpPlatform } from '@/lib/config/mcp-platform-configs';
import { MCP_PLATFORMS } from '@/lib/config/mcp-platform-configs';
import { cn } from '@/lib/ui/cn';
import { copyToClipboard } from '@/lib/utils/clipboard';

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cursor: Icons.cursor,
  vscode: Icons.vscode,
  windsurf: Icons.windsurf,
};

function PlatformIcon({ className, iconId }: { className?: string; iconId: NonNullable<McpPlatform['iconId']> }) {
  if (iconId === 'claude') {
    return <img src="/static/icons/ai-models/claude.png" alt="" className={cn('object-contain', className)} />;
  }
  const Icon = PLATFORM_ICONS[iconId];
  return Icon ? <Icon className={className} /> : null;
}

function isCliPlatform(platform: (typeof MCP_PLATFORMS)[number]) {
  return 'isCliCommand' in platform && platform.isCliCommand === true;
}

function isConnectorPlatform(platform: (typeof MCP_PLATFORMS)[number]) {
  return 'isConnector' in platform && platform.isConnector === true;
}

/**
 * Generates auth-free config for the landing page.
 * Users add the server first, then authenticate through their client.
 */
function generatePublicConfig(platformId: string, mcpUrl: string): string {
  switch (platformId) {
    case 'claude-code':
      return `claude mcp add --transport http debatekit ${mcpUrl}`;

    case 'claude-desktop':
      // Connectors: user pastes URL into Settings > Connectors > Add custom connector
      return mcpUrl;

    case 'cline':
      return JSON.stringify({
        mcpServers: {
          debatekit: { url: mcpUrl },
        },
      }, null, 2);

    case 'continue':
      return [
        'mcpServers:',
        '  - name: debatekit',
        '    type: streamable-http',
        `    url: "${mcpUrl}"`,
      ].join('\n');

    case 'cursor':
      return JSON.stringify({
        mcpServers: {
          debatekit: { type: 'http', url: mcpUrl },
        },
      }, null, 2);

    case 'vscode':
      return JSON.stringify({
        servers: {
          debatekit: { type: 'http', url: mcpUrl },
        },
      }, null, 2);

    case 'windsurf':
      return JSON.stringify({
        mcpServers: {
          debatekit: { serverUrl: mcpUrl },
        },
      }, null, 2);

    case 'zed':
      return JSON.stringify({
        context_servers: {
          debatekit: {
            args: ['-y', 'mcp-remote@latest', mcpUrl],
            command: 'npx',
          },
        },
      }, null, 2);

    default:
      return JSON.stringify({
        mcpServers: {
          debatekit: { url: mcpUrl },
        },
      }, null, 2);
  }
}

export const MCPPlatformCodeBlock = memo(() => {
  const [activeTab, setActiveTab] = useState(MCP_PLATFORMS[0]?.id ?? 'claude-code');
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posthog = usePostHog();

  const mcpUrl = useMemo(() => getMcpBaseUrl(), []);

  const configText = useMemo(
    () => generatePublicConfig(activeTab, mcpUrl),
    [activeTab, mcpUrl],
  );

  const activePlatform = MCP_PLATFORMS.find(p => p.id === activeTab);
  const isCli = activePlatform ? isCliPlatform(activePlatform) : false;
  const isConnector = activePlatform ? isConnectorPlatform(activePlatform) : false;

  const handleTabChange = useCallback((platformId: string) => {
    posthog?.capture('mcp_landing_platform_tab_changed', {
      platform: platformId,
      previous_platform: activeTab,
    });
    setActiveTab(platformId);
  }, [activeTab, posthog]);

  const handleCopy = () => {
    void copyToClipboard(configText);
    posthog?.capture('mcp_config_copied', { platform: activeTab, source: 'landing' });
    setCopied(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(setCopied, 2000, false);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-[#0d1117] min-w-0 w-full">
      {/* Tab bar */}
      <div className="flex items-center justify-between bg-white/[0.02]">
        <ScrollArea orientation="horizontal" className="w-full min-w-0">
          <div className="flex">
            {MCP_PLATFORMS.map(platform => (
              <button
                key={platform.id}
                type="button"
                onClick={() => handleTabChange(platform.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap',
                  activeTab === platform.id
                    ? 'text-teal-400 border-b-2 border-teal-400'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {platform.iconId && (
                  <PlatformIcon
                    iconId={platform.iconId}
                    className={cn(
                      'size-3.5 shrink-0',
                      activeTab === platform.id ? 'opacity-90' : 'opacity-50',
                    )}
                  />
                )}
                {platform.name}
              </button>
            ))}
          </div>
        </ScrollArea>
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Copy config"
        >
          {copied
            ? <Icons.check className="size-3.5 text-teal-400" />
            : <Icons.copy className="size-3.5" />}
        </button>
      </div>

      {/* Config file path badge */}
      <div className="px-3 sm:px-4 pt-2.5 sm:pt-3">
        <Badge
          variant="secondary"
          className={cn(
            'font-mono text-[11px]',
            isCli || isConnector
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-white/5 text-gray-400 border-white/10',
          )}
        >
          {isCli ? 'Terminal' : activePlatform?.configFilePath}
        </Badge>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto min-w-0">
        <pre
          className={cn(
            'p-3 sm:p-4 text-xs sm:text-sm font-mono leading-relaxed whitespace-pre-wrap break-all',
            isCli || isConnector ? 'text-emerald-400/90' : 'text-gray-300',
          )}
        >
          <code>{configText}</code>
        </pre>
      </div>

      {/* Auth hint */}
      <div className="px-3 sm:px-4 pb-2.5 sm:pb-3">
        <p className="text-[11px] text-gray-600">
          {isConnector
            ? 'Copy the URL, paste it into the connector dialog, and sign in when prompted.'
            : (
                <>
                  Add the server first — authenticate via your
                  {' '}
                  <a href="/auth/sign-in" className="text-teal-400/70 hover:text-teal-400 transition-colors">
                    API key
                  </a>
                  {' '}
                  when prompted.
                </>
              )}
        </p>
      </div>
    </div>
  );
});
