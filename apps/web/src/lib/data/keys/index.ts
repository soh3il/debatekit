import { adminKeys } from './admin';
import { authKeys } from './auth';
import { billingKeys } from './billing';
import { chatKeys } from './chat';
import { emailKeys } from './email';
import { mcpKeys } from './mcp';
import { modelKeys } from './models';
import { projectKeys } from './projects';
import { uploadKeys } from './uploads';
import { usageKeys } from './usage';
import { presetKeys } from './user-presets';

export const queryKeys = {
  ...adminKeys,
  ...authKeys,
  ...billingKeys,
  ...chatKeys,
  ...emailKeys,
  ...mcpKeys,
  ...modelKeys,
  ...projectKeys,
  ...uploadKeys,
  ...usageKeys,
  ...presetKeys,
} as const;

export {
  adminJobsInfiniteQueryOptions,
  adminJobsQueryOptions,
  adminPipelineRunsInfiniteQueryOptions,
  adminSettingsQueryOptions,
  adminTweetsInfiniteQueryOptions,
} from './admin';
export { apiKeysListQueryOptions, sessionQueryOptions } from './auth';
export { productsQueryOptions, subscriptionsQueryOptions } from './billing';
export {
  sidebarThreadsQueryOptions,
  threadBySlugQueryOptions,
  threadChangelogQueryOptions,
  threadPreSearchesQueryOptions,
} from './chat';
export { emailPreferencesQueryOptions } from './email';
export { QueryKeyFactory } from './factory';
export { mcpCreditsQueryOptions, mcpHistoryInfiniteQueryOptions, mcpHistoryQueryOptions, mcpUsageQueryOptions } from './mcp';
export { modelsQueryOptions } from './models';
export {
  projectAttachmentsQueryOptions,
  projectMemoryQueryOptions,
  projectQueryOptions,
  projectThreadsQueryOptions,
  sidebarProjectsQueryOptions,
} from './projects';
export { usageQueryOptions } from './usage';
