/**
 * Admin Tweets Mutation Hooks
 *
 * TanStack Query mutation hooks for admin scheduled tweet operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { shouldRetryMutation } from '@/hooks/utils';
import { invalidationPatterns } from '@/lib/data/cache';
import {
  createTweetService,
  deleteTweetService,
  sendTweetService,
  updateTweetService,
} from '@/services/api';

// Derive response types from service functions
type CreateTweetResult = Awaited<ReturnType<typeof createTweetService>>;
type UpdateTweetResult = Awaited<ReturnType<typeof updateTweetService>>;
type SendTweetResult = Awaited<ReturnType<typeof sendTweetService>>;
type DeleteTweetResult = Awaited<ReturnType<typeof deleteTweetService>>;

/**
 * Create scheduled tweet mutation
 */
export function useCreateTweetMutation() {
  const queryClient = useQueryClient();

  return useMutation<CreateTweetResult, Error, Parameters<typeof createTweetService>[0]>({
    mutationFn: createTweetService,
    onSuccess: () => {
      invalidationPatterns.adminTweets.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    retry: false,
    throwOnError: false,
  });
}

/**
 * Update scheduled tweet mutation
 */
export function useUpdateTweetMutation() {
  const queryClient = useQueryClient();

  return useMutation<UpdateTweetResult, Error, Parameters<typeof updateTweetService>[0]>({
    mutationFn: updateTweetService,
    onSuccess: () => {
      invalidationPatterns.adminTweets.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    retry: shouldRetryMutation,
    throwOnError: false,
  });
}

/**
 * Send tweet immediately mutation
 */
export function useSendTweetMutation() {
  const queryClient = useQueryClient();

  return useMutation<SendTweetResult, Error, Parameters<typeof sendTweetService>[0]>({
    mutationFn: sendTweetService,
    onSuccess: () => {
      invalidationPatterns.adminTweets.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    retry: false,
    throwOnError: false,
  });
}

/**
 * Delete scheduled tweet mutation
 */
export function useDeleteTweetMutation() {
  const queryClient = useQueryClient();

  return useMutation<DeleteTweetResult, Error, Parameters<typeof deleteTweetService>[0]>({
    mutationFn: deleteTweetService,
    onSuccess: () => {
      invalidationPatterns.adminTweets.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    retry: shouldRetryMutation,
    throwOnError: false,
  });
}
