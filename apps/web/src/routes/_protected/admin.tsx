import { UserRoles } from '@debatekit/shared/enums';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { AdminPageLayout } from '@/components/admin';

export const Route = createFileRoute('/_protected/admin')({
  beforeLoad: async ({ context }) => {
    const { session } = context;

    // Redirect non-admins to chat
    if (session?.user?.role !== UserRoles.ADMIN) {
      throw redirect({ to: '/chat' });
    }

    return { session };
  },
  component: AdminLayout,
});

/**
 * Admin route layout - full-width layout without chat sidebar.
 * Auth check happens in beforeLoad.
 */
function AdminLayout() {
  return (
    <AdminPageLayout>
      <Outlet />
    </AdminPageLayout>
  );
}
