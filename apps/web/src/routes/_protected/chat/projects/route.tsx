import { createFileRoute, Outlet } from '@tanstack/react-router';

import { requireNonAnonymous } from '@/lib/auth';

export const Route = createFileRoute('/_protected/chat/projects')({
  beforeLoad: ({ context }) => {
    requireNonAnonymous(context.session);
  },
  component: ProjectsLayout,
});

function ProjectsLayout() {
  return <Outlet />;
}
