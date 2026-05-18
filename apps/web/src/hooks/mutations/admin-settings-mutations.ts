/**
 * Admin Settings Mutation Hooks
 *
 * TanStack Query mutation hooks for admin settings operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidationPatterns } from '@/lib/data/cache';
import type { UpdateAdminSettingsParams } from '@/services/api/admin/settings';
import { updateAdminSettingsService } from '@/services/api/admin/settings';

// Derive response type from service function
type UpdateAdminSettingsResult = Awaited<ReturnType<typeof updateAdminSettingsService>>;

/**
 * Update admin settings mutation
 */
export function useUpdateAdminSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation<UpdateAdminSettingsResult, Error, { json: UpdateAdminSettingsParams }>({
    mutationFn: params => updateAdminSettingsService(params),
    onSuccess: () => {
      invalidationPatterns.adminSettings.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    retry: false,
    throwOnError: false,
  });
}
