import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { ChatLayoutShell } from '@/components/layouts/chat-layout-shell';
import { SidebarLoadingFallback } from '@/components/loading';
import { PricingContentSkeleton } from '@/components/pricing';
import { ChatLayoutProviders, PreferencesStoreProvider } from '@/components/providers';
import { HeaderSkeleton } from '@/components/skeletons';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { PublicPricingScreen } from '@/containers/screens/chat/billing/PublicPricingScreen';
import { useSession } from '@/lib/auth/client';
import { getAppBaseUrl } from '@/lib/config/base-urls';
import { productsQueryOptions, subscriptionsQueryOptions } from '@/lib/data/keys/billing';
import { sidebarThreadsQueryOptions } from '@/lib/data/keys/chat';

const pageTitle = 'Pricing - DebateKit';
const pageDescription = 'Choose your DebateKit plan - collaborative AI brainstorming with multiple AI models working together.';

const pricingSearchSchema = z.object({
  priceId: z.string().optional(),
});

function PricingLoadingSkeleton() {
  return (
    <SidebarProvider>
      <SidebarLoadingFallback count={5} />
      <SidebarInset className="flex flex-col relative">
        {/* Header skeleton with breadcrumb */}
        <HeaderSkeleton variant="with-breadcrumb" />
        {/* Centered pricing skeleton - matches final layout */}
        <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <PricingContentSkeleton />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const Route = createFileRoute('/chat/pricing')({
  component: PricingPage,
  validateSearch: pricingSearchSchema,
  loader: async ({ context }) => {
    const { queryClient, session } = context;

    // Always prefetch products (public data)
    const productsPromise = queryClient.ensureQueryData(productsQueryOptions);

    // If logged in, also prefetch sidebar threads and subscriptions
    // Subscriptions needed by PublicPricingScreen to show current plan status
    if (session) {
      await Promise.all([
        productsPromise,
        queryClient.ensureInfiniteQueryData(sidebarThreadsQueryOptions),
        queryClient.ensureQueryData(subscriptionsQueryOptions),
      ]);
    } else {
      await productsPromise;
    }

    return {};
  },
  // ✅ PUBLIC PAGE: Uses session from root context (already cached)
  // No duplicate getSession() call - shows different UI for logged-in vs guest
  head: () => {
    const siteUrl = getAppBaseUrl();
    return {
      meta: [
        { title: pageTitle },
        { name: 'description', content: pageDescription },
        { property: 'og:title', content: pageTitle },
        { property: 'og:description', content: pageDescription },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: `${siteUrl}/chat/pricing` },
        { property: 'og:image', content: `${siteUrl}/static/og-image.png` },
        { property: 'og:site_name', content: 'DebateKit' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@debatekitnow' },
        { name: 'twitter:title', content: pageTitle },
        { name: 'twitter:description', content: pageDescription },
        { name: 'twitter:image', content: `${siteUrl}/static/og-image.png` },
        { name: 'robots', content: 'index, follow' },
      ],
      links: [
        { rel: 'canonical', href: `${siteUrl}/chat/pricing` },
      ],
    };
  },
  pendingComponent: PricingLoadingSkeleton,
  preload: true,
  headers: () => ({
    'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
  }),
});

function PricingPage() {
  // Get session from hook (reactive) and route context (SSR fallback)
  const { data: session } = useSession();
  const routeContext = Route.useRouteContext();
  const activeSession = session ?? routeContext.session ?? null;

  return (
    <PreferencesStoreProvider>
      <ChatLayoutProviders>
        <ChatLayoutShell session={activeSession}>
          <PublicPricingScreen />
        </ChatLayoutShell>
      </ChatLayoutProviders>
    </PreferencesStoreProvider>
  );
}
