import { createFileRoute } from '@tanstack/react-router';

import { ConnectPage } from '@/components/connect/connect-page';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/_protected/chat/connect')({
  component: ConnectPage,
  head: () => getSeoHead(PAGE_TYPES.CONNECT),
  headers: () => getSeoHeaders(PAGE_TYPES.CONNECT)?.() ?? {},
});
