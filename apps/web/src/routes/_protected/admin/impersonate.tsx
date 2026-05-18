import { createFileRoute } from '@tanstack/react-router';

import { ImpersonateContent } from '@/components/admin/impersonate-content';

export const Route = createFileRoute('/_protected/admin/impersonate')({
  component: ImpersonateContent,
});
