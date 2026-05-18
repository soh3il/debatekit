import { createFileRoute } from '@tanstack/react-router';

import ComplianceAdvisoryScreen from '@/containers/screens/solutions/ComplianceAdvisoryScreen';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/solutions/compliance-advisory')({
  component: ComplianceAdvisoryScreen,
  head: () => getSeoHead(PAGE_TYPES.COMPLIANCE_ADVISORY),
  headers: () => getSeoHeaders(PAGE_TYPES.COMPLIANCE_ADVISORY)?.() ?? {},
  preload: true,
});
