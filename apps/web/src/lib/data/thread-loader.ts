/**
 * Thread Loader Utilities
 *
 * Shared route loader logic for consistent SSR hydration across
 * chat thread routes (/chat/$slug and /chat/projects/$projectId/$slug).
 *
 * Lives in lib/data/ alongside query options it orchestrates.
 */

import type { QueryClient } from '@tanstack/react-query';

import { queryKeys, threadBySlugQueryOptions, threadChangelogQueryOptions, threadPreSearchesQueryOptions } from '@/lib/data/keys';
import { STALE_TIME_PRESETS } from '@/lib/data/stale-times';
import { rlog } from '@/lib/utils/dev-logger';
import type {
  ChangelogItem,
  GetThreadBySlugResponse,
  StoredPreSearch,
} from '@/services/api';
import { getPodcastEpisodesService } from '@/services/api';

// ============================================================================
// Types
// ============================================================================

export type ChatThreadLoaderData = {
  threadTitle: string | null;
  threadId: string | null;
  threadData: GetThreadBySlugResponse['data'] | null;
  preSearches: StoredPreSearch[] | undefined;
  changelog: ChangelogItem[] | undefined;
  streamResumption: undefined;
};

export type ProjectChatThreadLoaderData = {
  projectName: string | null;
} & ChatThreadLoaderData;

// ============================================================================
// Empty Loader Data Factory
// ============================================================================

export function createEmptyLoaderData(): ChatThreadLoaderData;
export function createEmptyLoaderData(opts: { projectName: string | null }): ProjectChatThreadLoaderData;
export function createEmptyLoaderData(opts?: { projectName?: string | null }): ChatThreadLoaderData | ProjectChatThreadLoaderData {
  const base: ChatThreadLoaderData = {
    changelog: undefined,
    preSearches: undefined,
    streamResumption: undefined,
    threadData: null,
    threadId: null,
    threadTitle: null,
  };

  if (opts && 'projectName' in opts) {
    return { ...base, projectName: opts.projectName };
  }

  return base;
}

// ============================================================================
// Auxiliary Data Fetching
// ============================================================================

type AuxiliaryDataResult = {
  preSearches: StoredPreSearch[] | undefined;
  changelog: ChangelogItem[] | undefined;
};

/**
 * Fetches changelog, preSearches, and prefetches podcast episodes for a thread.
 * On server: awaits all for proper hydration.
 * On client: checks cache first, then fetches missing data.
 */
async function fetchAuxiliaryData({
  isServer,
  queryClient,
  threadId,
}: {
  queryClient: QueryClient;
  threadId: string;
  isServer: boolean;
}): Promise<AuxiliaryDataResult> {
  const changelogOptions = threadChangelogQueryOptions(threadId);
  const preSearchesOptions = threadPreSearchesQueryOptions(threadId);

  const cachedChangelog = !isServer ? queryClient.getQueryData(changelogOptions.queryKey) : null;
  const cachedPreSearches = !isServer ? queryClient.getQueryData(preSearchesOptions.queryKey) : null;

  const [changelogResult, preSearchesResult] = await Promise.all([
    cachedChangelog
      ? Promise.resolve(cachedChangelog)
      : queryClient.ensureQueryData(changelogOptions).catch((err) => {
          rlog.stuck('loader', `changelog fetch failed for ${threadId}: ${err instanceof Error ? err.message : 'unknown'}`);
          return null;
        }),
    cachedPreSearches
      ? Promise.resolve(cachedPreSearches)
      : queryClient.ensureQueryData(preSearchesOptions).catch((err) => {
          rlog.stuck('loader', `preSearches fetch failed for ${threadId}: ${err instanceof Error ? err.message : 'unknown'}`);
          return null;
        }),
    queryClient.prefetchQuery({
      queryFn: () => getPodcastEpisodesService({ threadId }),
      queryKey: queryKeys.podcast.episodes(threadId),
      staleTime: STALE_TIME_PRESETS.medium,
    }),
  ]);

  return {
    changelog: changelogResult?.success ? changelogResult.data?.items : undefined,
    preSearches: preSearchesResult?.success ? preSearchesResult.data?.items : undefined,
  };
}

// ============================================================================
// Main Loader Function
// ============================================================================

type FetchThreadDataParams = {
  queryClient: QueryClient;
  slug: string;
  isServer: boolean;
  loaderContext: string;
};

export async function fetchThreadData({
  isServer,
  loaderContext,
  queryClient,
  slug,
}: FetchThreadDataParams): Promise<ChatThreadLoaderData> {
  const options = threadBySlugQueryOptions(slug);

  // Check cache for prefetched thread data (from flow-controller)
  const cachedThreadData = !isServer
    ? queryClient.getQueryData<GetThreadBySlugResponse>(options.queryKey)
    : null;
  const hasPrefetchMeta = cachedThreadData?.meta?.requestId === 'prefetch';

  // Early return when flow-controller prefetched VALID data (must have messages)
  // "Shell" data (thread metadata without messages) should NOT trigger early return
  if (hasPrefetchMeta && cachedThreadData?.success && cachedThreadData.data.messages.length > 0) {
    const threadData = cachedThreadData.data;
    const prefetchThreadId = threadData.thread.id;

    const auxiliaryData = prefetchThreadId
      ? await fetchAuxiliaryData({ isServer: false, queryClient, threadId: prefetchThreadId })
      : { changelog: undefined, preSearches: undefined };

    return {
      changelog: auxiliaryData.changelog,
      preSearches: auxiliaryData.preSearches,
      streamResumption: undefined,
      threadData,
      threadId: prefetchThreadId ?? null,
      threadTitle: threadData.thread.title ?? null,
    };
  }

  // No prefetch hit - fetch thread data
  try {
    await queryClient.ensureQueryData(options);
  } catch (error) {
    rlog.stuck('loader-error', `${loaderContext}: ${error instanceof Error ? error.message : String(error)}`);
    return createEmptyLoaderData();
  }

  const cachedData = queryClient.getQueryData<GetThreadBySlugResponse>(options.queryKey);
  const threadId = cachedData?.success && cachedData.data?.thread?.id;
  const threadTitle = cachedData?.success && cachedData.data?.thread?.title
    ? cachedData.data.thread.title
    : null;

  const auxiliaryData = threadId
    ? await fetchAuxiliaryData({ isServer, queryClient, threadId })
    : { changelog: undefined, preSearches: undefined };

  const threadData = cachedData?.success ? cachedData.data : null;

  return {
    changelog: auxiliaryData.changelog,
    preSearches: auxiliaryData.preSearches,
    streamResumption: undefined,
    threadData,
    threadId: threadId || null,
    threadTitle,
  };
}
