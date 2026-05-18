import { createFileRoute } from '@tanstack/react-router';

import HealthcareClinicalScreen from '@/containers/screens/solutions/HealthcareClinicalScreen';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/solutions/healthcare-clinical')({
  component: HealthcareClinicalScreen,
  head: () => getSeoHead(PAGE_TYPES.HEALTHCARE_CLINICAL),
  headers: () => getSeoHeaders(PAGE_TYPES.HEALTHCARE_CLINICAL)?.() ?? {},
  preload: true,
});
