import { createFileRoute } from '@tanstack/react-router';

import LegalReviewScreen from '@/containers/screens/solutions/LegalReviewScreen';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/solutions/legal-review')({
  component: LegalReviewScreen,
  head: () => getSeoHead(PAGE_TYPES.LEGAL_REVIEW),
  headers: () => getSeoHeaders(PAGE_TYPES.LEGAL_REVIEW)?.() ?? {},
  preload: true,
});
