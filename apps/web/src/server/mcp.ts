import { createServerFn } from '@tanstack/react-start';

import type { GetMcpCreditsResponse, GetMcpHistoryResponse, GetMcpUsageResponse } from '@/services/api';
import { getMcpCreditsService, getMcpHistoryService, getMcpUsageService } from '@/services/api';

import type { ServerFnErrorResponse } from './schemas';

type GetMcpCreditsResult = GetMcpCreditsResponse | ServerFnErrorResponse;
type GetMcpUsageResult = GetMcpUsageResponse | ServerFnErrorResponse;
type GetMcpHistoryResult = GetMcpHistoryResponse | ServerFnErrorResponse;

export const getMcpCredits = createServerFn({ method: 'GET' }).handler(
  async ({ context }): Promise<GetMcpCreditsResult> => {
    return await getMcpCreditsService({ cookieHeader: context.cookieHeader });
  },
);

export const getMcpUsage = createServerFn({ method: 'GET' }).handler(
  async ({ context }): Promise<GetMcpUsageResult> => {
    return await getMcpUsageService({ cookieHeader: context.cookieHeader });
  },
);

export const getMcpHistory = createServerFn({ method: 'GET' }).handler(
  async ({ context }): Promise<GetMcpHistoryResult> => {
    return await getMcpHistoryService({ limit: 20 }, { cookieHeader: context.cookieHeader });
  },
);
