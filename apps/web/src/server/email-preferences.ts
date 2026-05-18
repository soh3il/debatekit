import { createServerFn } from '@tanstack/react-start';

import type { GetEmailPreferencesResponse } from '@/services/api';
import { getEmailPreferencesService } from '@/services/api';

import type { ServerFnErrorResponse } from './schemas';

type GetEmailPreferencesResult = GetEmailPreferencesResponse | ServerFnErrorResponse;

export const getEmailPreferences = createServerFn({ method: 'GET' }).handler(
  async ({ context }): Promise<GetEmailPreferencesResult> => {
    return await getEmailPreferencesService(undefined, { cookieHeader: context.cookieHeader });
  },
);
