import { createServerFn } from '@tanstack/react-start';

import type { AdminSettingsResponse } from '@/services/api';
import { getAdminSettingsService } from '@/services/api';

import type { ServerFnErrorResponse } from './schemas';

type AdminSettingsResult = AdminSettingsResponse | ServerFnErrorResponse;

export const getAdminSettings = createServerFn({ method: 'GET' })
  .handler(async ({ context }): Promise<AdminSettingsResult> => {
    return await getAdminSettingsService({ cookieHeader: context.cookieHeader });
  });
