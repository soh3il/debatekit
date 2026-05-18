import { createFileRoute } from '@tanstack/react-router';

import LlmCouncilScreen from '@/containers/screens/solutions/LlmCouncilScreen';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/solutions/llm-council')({
  component: LlmCouncilScreen,
  head: () => getSeoHead(PAGE_TYPES.LLM_COUNCIL),
  headers: () => getSeoHeaders(PAGE_TYPES.LLM_COUNCIL)?.() ?? {},
  preload: true,
});
