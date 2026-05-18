import { createFileRoute } from '@tanstack/react-router';

import MADealScreeningScreen from '@/containers/screens/solutions/MADealScreeningScreen';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/solutions/ma-deal-screening')({
  component: MADealScreeningScreen,
  head: () => getSeoHead(PAGE_TYPES.MA_DEAL_SCREENING),
  headers: () => getSeoHeaders(PAGE_TYPES.MA_DEAL_SCREENING)?.() ?? {},
  preload: true,
});
