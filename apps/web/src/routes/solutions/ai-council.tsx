import { createFileRoute } from '@tanstack/react-router';

import AiAssistantScreen from '@/containers/screens/solutions/AiAssistantScreen';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/solutions/ai-council')({
  component: AiAssistantScreen,
  head: () => getSeoHead(PAGE_TYPES.AI_COUNCIL),
  headers: () => getSeoHeaders(PAGE_TYPES.AI_COUNCIL)?.() ?? {},
  preload: true,
});
