import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';

import type {
  GetProjectResponse,
  ListProjectAttachmentsResponse,
} from '@/services/api';
import {
  getProjectService,
  listProjectAttachmentsService,
} from '@/services/api';
import type { GetProjectMemoryResponse } from '@/services/api/memories';
import { getProjectMemoryService } from '@/services/api/memories';

import type { ServerFnErrorResponse } from './schemas';
import { idSchema } from './schemas';

type GetProjectResult = GetProjectResponse | ServerFnErrorResponse;
type ListProjectAttachmentsResult = ListProjectAttachmentsResponse | ServerFnErrorResponse;
type GetProjectMemoryResult = GetProjectMemoryResponse | ServerFnErrorResponse;

export const getProjectById = createServerFn({ method: 'GET' })
  .inputValidator(zodValidator(idSchema))
  .handler(async ({ context, data }): Promise<GetProjectResult> => {
    return await getProjectService({ param: { id: data } }, { cookieHeader: context.cookieHeader });
  });

export const getProjectAttachments = createServerFn({ method: 'GET' })
  .inputValidator(zodValidator(idSchema))
  .handler(async ({ context, data }): Promise<ListProjectAttachmentsResult> => {
    return await listProjectAttachmentsService(
      { param: { id: data }, query: { limit: 50 } },
      { cookieHeader: context.cookieHeader },
    );
  });

export const getProjectMemory = createServerFn({ method: 'GET' })
  .inputValidator(zodValidator(idSchema))
  .handler(async ({ context, data }): Promise<GetProjectMemoryResult> => {
    return await getProjectMemoryService({ param: { id: data } }, { cookieHeader: context.cookieHeader });
  });
