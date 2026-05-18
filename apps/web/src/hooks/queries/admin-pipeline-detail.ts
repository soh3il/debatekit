/**
 * Admin Pipeline Run Detail Query Hook
 */

import { useQuery } from '@tanstack/react-query';

import { useAuthCheck } from '@/hooks/utils';
import { queryKeys } from '@/lib/data/keys';
import { getPipelineRunService } from '@/services/api/admin/pipeline';

/**
 * Query hook for fetching a single pipeline run's detail
 */
export function useAdminPipelineRunDetailQuery(runId: string | null) {
  const { isAuthenticated } = useAuthCheck();

  return useQuery({
    enabled: isAuthenticated && !!runId,
    queryFn: () => getPipelineRunService(runId ?? ''),
    queryKey: queryKeys.adminPipeline.detail(runId ?? ''),
    staleTime: 30_000,
  });
}
