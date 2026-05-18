import { createFileRoute } from '@tanstack/react-router';

import { ChatLayoutShell } from '@/components/layouts/chat-layout-shell';
import { PitchPage } from '@/components/pitch/pitch-page';
import { ChatLayoutProviders, PreferencesStoreProvider } from '@/components/providers';
import { useSession } from '@/lib/auth/client';
import { sidebarThreadsQueryOptions } from '@/lib/data/keys/chat';
import { getSeoHead, getSeoHeaders } from '@/lib/seo/helpers';
import { PAGE_TYPES } from '@/lib/seo/schemas';

export const Route = createFileRoute('/chat/why-debatekit')({
  component: WhyDebateKitPage,
  loader: async ({ context }) => {
    const { queryClient, session } = context;

    if (session) {
      await queryClient.ensureInfiniteQueryData(sidebarThreadsQueryOptions);
    }

    return {};
  },
  head: () => getSeoHead(PAGE_TYPES.WHY_DEBATEKIT),
  headers: () => getSeoHeaders(PAGE_TYPES.WHY_DEBATEKIT)?.() ?? {},
});

function WhyDebateKitPage() {
  const { data: session } = useSession();
  const routeContext = Route.useRouteContext();
  const activeSession = session ?? routeContext.session ?? null;

  return (
    <PreferencesStoreProvider>
      <ChatLayoutProviders>
        <ChatLayoutShell session={activeSession}>
          <PitchPage />
        </ChatLayoutShell>
      </ChatLayoutProviders>
    </PreferencesStoreProvider>
  );
}
