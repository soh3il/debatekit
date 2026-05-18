/**
 * Podcast Mutation Hooks
 *
 * TanStack Query mutation for enabling podcast auto-generation on threads.
 * One-way enable — never disables or cancels.
 */

import { UserRoles } from '@debatekit/shared/enums';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import enCommon from '@/i18n/locales/en/common.json';
import { AnalyticsEvents, useAnalytics } from '@/lib/analytics';
import { useSession } from '@/lib/auth/client';
import { invalidationPatterns } from '@/lib/data/cache';
import { queryKeys } from '@/lib/data/keys';
import { showApiErrorToast, showApiSuccessToast } from '@/lib/toast';
import { updateThreadService } from '@/services/api';

/**
 * Enable podcast auto-generation for a thread (one-way)
 * PATCH /chat/threads/:id with { enablePodcast: true }
 *
 * Always sends enablePodcast: true. No toggle, no rollback.
 * Invalidates thread detail + podcast queries on success.
 */
export function useEnablePodcastMutation() {
  const queryClient = useQueryClient();
  const { track } = useAnalytics();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === UserRoles.ADMIN;

  return useMutation({
    mutationFn: ({ threadId }: { threadId: string }) => {
      if (!isAdmin) {
        return Promise.reject(new Error('Admin access required'));
      }
      return updateThreadService({
        json: { enablePodcast: true },
        param: { id: threadId },
      });
    },
    onError: (_err) => {
      showApiErrorToast(enCommon.podcast.podcastToggleError, _err);
    },
    onSuccess: (_data, variables) => {
      track(AnalyticsEvents.PODCAST_AUTO_ENABLED, {
        thread_id: variables.threadId,
      });

      showApiSuccessToast(
        enCommon.podcast.podcastEnabled,
        enCommon.podcast.podcastEnabledDescription,
      );

      // Invalidate thread detail to refresh enablePodcast state
      queryClient.invalidateQueries({
        queryKey: queryKeys.threads.detail(variables.threadId),
      });

      // Use centralized pattern: podcast queries + usage stats
      invalidationPatterns.podcastGenerate(variables.threadId).forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    retry: false,
    throwOnError: false,
  });
}
