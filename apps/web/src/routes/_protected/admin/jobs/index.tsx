import { createFileRoute } from '@tanstack/react-router';

import { AdminJobsScreen } from '@/containers/screens/admin/AdminJobsScreen';
import { adminJobsInfiniteQueryOptions, adminPipelineRunsInfiniteQueryOptions, adminSettingsQueryOptions, adminTweetsInfiniteQueryOptions } from '@/lib/data/keys/admin';
import { rlog } from '@/lib/utils/dev-logger';

export const Route = createFileRoute('/_protected/admin/jobs/')({
  component: AdminJobsScreen,

  loader: async ({ context }) => {
    const { queryClient } = context;

    try {
      await Promise.allSettled([
        queryClient.ensureInfiniteQueryData(adminJobsInfiniteQueryOptions),
        queryClient.ensureQueryData(adminSettingsQueryOptions),
        queryClient.ensureInfiniteQueryData(adminPipelineRunsInfiniteQueryOptions),
        queryClient.ensureInfiniteQueryData(adminTweetsInfiniteQueryOptions),
      ]);
    } catch (error) {
      rlog.stuck('admin-jobs-loader', `error: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  staleTime: 0,
});
