import { createFileRoute, Outlet } from '@tanstack/react-router';

import { ChatLayoutShell } from '@/components/layouts/chat-layout-shell';
import { ChatLayoutProviders } from '@/components/providers/chat-layout-providers';
import { useSession } from '@/lib/auth/client';

export const Route = createFileRoute('/_protected/chat')({
  component: ChatLayout,
});

/**
 * Chat route layout - wraps chat pages with sidebar and chat providers.
 * Admin pages use a separate full-width layout without these providers.
 *
 * Uses routeContext.session (SSR-resolved from _protected beforeLoad) merged
 * with client-side useSession so the sidebar & user info are pre-hydrated
 * on the initial server render without waiting for client-side auth.
 */
function ChatLayout() {
  const routeContext = Route.useRouteContext();
  const { data: clientSession } = useSession();
  const activeSession = clientSession ?? routeContext.session;

  return (
    <ChatLayoutProviders>
      <ChatLayoutShell session={activeSession}>
        <Outlet />
      </ChatLayoutShell>
    </ChatLayoutProviders>
  );
}
