/**
 * Admin Pipeline Mutation Hooks
 *
 * TanStack Query mutation hooks for admin content pipeline operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidationPatterns } from '@/lib/data/cache';
import type { TriggerPipelineRunRequest } from '@/services/api/admin/pipeline';
import { cancelPipelineRunService, triggerPipelineRunService } from '@/services/api/admin/pipeline';

// Derive response types from service functions
type TriggerPipelineRunResult = Awaited<ReturnType<typeof triggerPipelineRunService>>;
type CancelPipelineRunResult = Awaited<ReturnType<typeof cancelPipelineRunService>>;

/**
 * Trigger a manual pipeline run mutation
 */
export function useTriggerPipelineMutation() {
  const queryClient = useQueryClient();

  return useMutation<TriggerPipelineRunResult, Error, TriggerPipelineRunRequest | undefined>({
    mutationFn: params => triggerPipelineRunService(params),
    onSuccess: () => {
      invalidationPatterns.adminPipeline.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    retry: false,
    throwOnError: false,
  });
}

/**
 * Cancel a pipeline run mutation
 */
export function useCancelPipelineRunMutation() {
  const queryClient = useQueryClient();

  return useMutation<CancelPipelineRunResult, Error, string>({
    mutationFn: cancelPipelineRunService,
    onSuccess: () => {
      invalidationPatterns.adminPipeline.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      // Also invalidate jobs since cancelling a pipeline run may cancel its jobs
      invalidationPatterns.adminJobs.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    retry: false,
    throwOnError: false,
  });
}
