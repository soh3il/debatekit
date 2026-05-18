import { useEffect, useRef } from 'react';

import { MCPPlatformCodeBlock } from '@/components/landing/mcp-platform-code-block';
import { AnalyticsEvents, DiscoverableFeatures, useAnalytics } from '@/lib/analytics';
import { useTranslations } from '@/lib/i18n';

type McpSetupGuideProps = {
  apiKey?: string | null;
  onCreateKey?: (suggestedName?: string) => void;
};

export function McpSetupGuide({ apiKey: _apiKey, onCreateKey: _onCreateKey }: McpSetupGuideProps) {
  const t = useTranslations('settings.apiKeys.mcp');
  const { track, trackFeatureDiscovery } = useAnalytics();
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) {
      return;
    }
    viewedRef.current = true;
    track(AnalyticsEvents.MCP_SETUP_GUIDE_VIEWED);
    trackFeatureDiscovery(DiscoverableFeatures.MCP_SETUP, 'setup_guide');
  }, [track, trackFeatureDiscovery]);

  return (
    <div className="overflow-hidden min-w-0">
      <p className="text-xs text-muted-foreground pb-3">
        {t('description')}
      </p>

      <MCPPlatformCodeBlock />
    </div>
  );
}
