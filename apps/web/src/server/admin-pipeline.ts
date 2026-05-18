import { createServerFn } from '@tanstack/react-start';

import type { ListPipelineRunsResponse } from '@/services/api';
import { listPipelineRunsService } from '@/services/api';

import type { ServerFnErrorResponse } from './schemas';

type ListPipelineRunsResult = ListPipelineRunsResponse | ServerFnErrorResponse;

export const getAdminPipelineRuns = createServerFn({ method: 'GET' })
  .handler(async ({ context }): Promise<ListPipelineRunsResult> => {
    return await listPipelineRunsService({ query: {} }, { cookieHeader: context.cookieHeader });
  });
