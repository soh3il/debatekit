import { createServerFn } from '@tanstack/react-start';

import type { ListTweetsResponse } from '@/services/api';
import { listTweetsService } from '@/services/api';

import type { ServerFnErrorResponse } from './schemas';

type ListTweetsResult = ListTweetsResponse | ServerFnErrorResponse;

export const getAdminTweets = createServerFn({ method: 'GET' })
  .handler(async ({ context }): Promise<ListTweetsResult> => {
    return await listTweetsService({ query: {} }, { cookieHeader: context.cookieHeader });
  });
