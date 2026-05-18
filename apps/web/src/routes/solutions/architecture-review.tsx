import { createFileRoute } from '@tanstack/react-router';

import ArchitectureReviewScreen from '@/containers/screens/solutions/ArchitectureReviewScreen';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/solutions/architecture-review')({
  component: ArchitectureReviewScreen,
  head: () => getSeoHead(PAGE_TYPES.ARCHITECTURE_REVIEW),
  headers: () => getSeoHeaders(PAGE_TYPES.ARCHITECTURE_REVIEW)?.() ?? {},
  preload: true,
});
