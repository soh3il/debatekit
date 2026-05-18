import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidationPatterns } from '@/lib/data/cache';
import { updateEmailPreferencesService } from '@/services/api';

type UpdateResult = Awaited<ReturnType<typeof updateEmailPreferencesService>>;

export function useUpdateEmailPreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation<UpdateResult, Error, Parameters<typeof updateEmailPreferencesService>[0]>({
    mutationFn: updateEmailPreferencesService,
    onSuccess: () => {
      invalidationPatterns.emailPreferences.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    retry: false,
    throwOnError: false,
  });
}
