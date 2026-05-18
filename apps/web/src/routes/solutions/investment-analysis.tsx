import { createFileRoute } from '@tanstack/react-router';

import InvestmentAnalysisScreen from '@/containers/screens/solutions/InvestmentAnalysisScreen';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/solutions/investment-analysis')({
  component: InvestmentAnalysisScreen,
  head: () => getSeoHead(PAGE_TYPES.INVESTMENT_ANALYSIS),
  headers: () => getSeoHeaders(PAGE_TYPES.INVESTMENT_ANALYSIS)?.() ?? {},
  preload: true,
});
