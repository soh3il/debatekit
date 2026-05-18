import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/chat/projects/$projectId')({
  component: ProjectIdLayout,
});

function ProjectIdLayout() {
  return <Outlet />;
}
