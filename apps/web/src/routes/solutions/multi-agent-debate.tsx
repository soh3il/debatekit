import { createFileRoute } from '@tanstack/react-router';

import MultiAgentDebateScreen from '@/containers/screens/solutions/MultiAgentDebateScreen';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/solutions/multi-agent-debate')({
  component: MultiAgentDebateScreen,
  head: () => getSeoHead(PAGE_TYPES.MULTI_AGENT_DEBATE),
  headers: () => getSeoHeaders(PAGE_TYPES.MULTI_AGENT_DEBATE)?.() ?? {},
  preload: true,
});
