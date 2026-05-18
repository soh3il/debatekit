import { createFileRoute } from '@tanstack/react-router';

import MCPLandingScreen from '@/containers/screens/MCPLandingScreen';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/mcp/')({
  component: MCPLandingScreen,
  head: () => getSeoHead(PAGE_TYPES.MCP_LANDING),
  headers: () => getSeoHeaders(PAGE_TYPES.MCP_LANDING)?.() ?? {},
  preload: true,
});
