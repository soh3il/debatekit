import { createServerFn } from '@tanstack/react-start';

import type { ListApiKeysResponse } from '@/services/api';
import { listApiKeysService } from '@/services/api';

import type { ServerFnErrorResponse } from './schemas';

type GetApiKeysResult = ListApiKeysResponse | ServerFnErrorResponse;

export const getApiKeys = createServerFn({ method: 'GET' }).handler(
  async ({ context }): Promise<GetApiKeysResult> => {
    return await listApiKeysService(undefined, { cookieHeader: context.cookieHeader });
  },
);
