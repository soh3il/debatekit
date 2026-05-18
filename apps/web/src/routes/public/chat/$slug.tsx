import { MessageRoles } from '@debatekit/shared';
import { createFileRoute } from '@tanstack/react-router';

import { PublicChatSkeleton } from '@/components/loading';
import PublicChatThreadScreen from '@/containers/screens/chat/PublicChatThreadScreen';
import { getApiBaseUrl, getAppBaseUrl } from '@/lib/config/base-urls';
import { STALE_TIME_PRESETS, STALE_TIMES } from '@/lib/data/stale-times';
import { queryKeys } from '@/lib/data/keys';
import type { ApiMessage, PublicThreadData } from '@/services/api';
import { getPublicPodcastEpisodesService, getPublicThreadService } from '@/services/api';

/** Error states for public thread loading */
type PublicThreadErrorState = 'not_found' | 'no_longer_public' | null;

/** Loader data structure */
type PublicChatLoaderData = {
  errorState: PublicThreadErrorState;
  initialData: PublicThreadData | null;
  podcastEpisodeCount: number;
  roundCount: number;
};

export const Route = createFileRoute('/public/chat/$slug')({
  // NOTE: No route-level staleTime/gcTime - TanStack Query manages data freshness
  // @see https://tanstack.com/router/latest/docs/framework/react/guide/preloading#preloading-with-external-libraries
  //
  // ✅ SSR: Use ensureQueryData to guarantee data is available before rendering
  // prefetchQuery doesn't guarantee data and can cause "not found" flash during hydration
  loader: async ({ params, context }) => {
    const { queryClient } = context;

    try {
      // Fetch thread data and podcast episodes in parallel
      // ensureQueryData guarantees data is in cache before component renders
      const [response, podcastResponse] = await Promise.all([
        queryClient.ensureQueryData({
          queryKey: queryKeys.threads.public(params.slug),
          queryFn: () => getPublicThreadService({ param: { slug: params.slug } }),
          staleTime: STALE_TIMES.publicThreadDetail,
        }),
        // Ensure podcast episodes are in cache so the listen button renders on SSR
        // Caught: if podcast fetch fails, page still renders without listen button
        queryClient.ensureQueryData({
          queryKey: queryKeys.podcast.publicEpisodes(params.slug),
          queryFn: () => getPublicPodcastEpisodesService({ slug: params.slug }),
          staleTime: STALE_TIME_PRESETS.short,
        }).catch(() => null),
      ]);

      // Extract data for head() metadata and component props
      const initialData: PublicThreadData | null = response?.success ? response.data : null;

      // Count user messages (rounds) for cache invalidation
      const roundCount = initialData?.messages?.filter((m: ApiMessage) => m.role === MessageRoles.USER).length ?? 0;

      // Count podcast episodes for ETag — invalidates edge cache when podcast is generated
      const podcastEpisodeCount = podcastResponse?.success ? podcastResponse.data?.length ?? 0 : 0;

      return { errorState: null, initialData, podcastEpisodeCount, roundCount } satisfies PublicChatLoaderData;
    } catch (error) {
      // ✅ GRACEFUL ERROR HANDLING: Catch API errors and return error state
      // This prevents 500 errors and allows showing user-friendly error pages
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if thread was made private (410 Gone) or not found (404)
      const isNoLongerPublic = errorMessage.includes('no longer publicly available')
        || errorMessage.includes('410')
        || errorMessage.includes('gone');

      return {
        errorState: isNoLongerPublic ? 'no_longer_public' : 'not_found',
        initialData: null,
        podcastEpisodeCount: 0,
        roundCount: 0,
      } satisfies PublicChatLoaderData;
    }
  },
  // ✅ ISR CACHING: Long cache with tag-based invalidation
  // Cache invalidation handles visibility changes via KV tags
  headers: ({ loaderData }): { 'Cache-Control': string; 'Pragma'?: string; 'ETag'?: string } => {
    const errorState = loaderData?.errorState;

    // ✅ NO CACHE FOR ERRORS: Don't cache private/not-found responses
    if (errorState) {
      return {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      };
    }

    // ISR cache - browser always revalidates, 1 day edge, 1 hour SWR
    // max-age=0 forces browser to revalidate with edge on every visit
    // ETag includes both round count and podcast episode count so edge cache
    // invalidates when either new rounds are added or podcasts are generated
    const roundCount = loaderData?.roundCount ?? 0;
    const podcastCount = loaderData?.podcastEpisodeCount ?? 0;
    return {
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=3600',
      'ETag': `"rounds-${roundCount}-podcasts-${podcastCount}"`,
    };
  },
  pendingComponent: PublicChatSkeleton,
  // ✅ SKELETON FLASH FIX: Only show pending component after 300ms
  pendingMs: 300,
  head: ({ loaderData, params }) => {
    const data = loaderData;
    const errorState = data?.errorState;

    // ✅ ERROR PAGES: Don't index, minimal metadata
    if (errorState) {
      const title = errorState === 'no_longer_public'
        ? 'Conversation No Longer Public'
        : 'Conversation Not Found';
      return {
        meta: [
          { title: `${title} - DebateKit` },
          { name: 'robots', content: 'noindex, nofollow' },
        ],
      };
    }

    const thread = data?.initialData?.thread;
    const participants = data?.initialData?.participants || [];
    const messages = data?.initialData?.messages || [];

    const title = thread?.title || 'Shared AI Conversation';
    const modelCount = participants.length;
    const messageCount = messages.length;

    // Rich description with stats
    const description = thread?.title
      ? `"${thread.title}" - AI discussion with ${modelCount} model${modelCount !== 1 ? 's' : ''} and ${messageCount} message${messageCount !== 1 ? 's' : ''} on DebateKit`
      : 'View this collaborative AI brainstorming session on DebateKit';

    // Dynamic URLs based on environment
    const siteUrl = getAppBaseUrl();
    const apiUrl = getApiBaseUrl();
    const pageUrl = `${siteUrl}/public/chat/${params.slug}`;
    const ogImageUrl = `${apiUrl}/og/chat?slug=${params.slug}`;

    return {
      meta: [
        { title: `${title} - DebateKit` },
        { name: 'description', content: description },
        // Open Graph
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: pageUrl },
        { property: 'og:image', content: ogImageUrl },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:site_name', content: 'DebateKit' },
        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@debatekitnow' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: ogImageUrl },
        // SEO - max-snippet:-1 allows full snippet; max-image-preview:large enables rich cards
        { name: 'robots', content: 'index, follow, max-snippet:-1, max-image-preview:large' },
        // Article metadata
        { property: 'article:section', content: 'AI Conversations' },
      ],
      links: [
        { rel: 'canonical', href: pageUrl },
      ],
    };
  },
  component: PublicChatThread,
});

function PublicChatThread() {
  const { slug } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const { initialData, errorState } = loaderData;

  // Direct render - no Suspense/lazy that would cause skeleton flash during hydration
  // pendingComponent handles navigation skeleton, loader ensures data is ready for SSR
  return <PublicChatThreadScreen slug={slug} initialData={initialData} errorState={errorState} />;
}
