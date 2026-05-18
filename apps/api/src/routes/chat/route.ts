import { createRoute, z } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import { ApiErrorResponseSchema, createApiResponseSchema, createMutationRouteResponses, createProtectedRouteResponses, createPublicRouteResponses, CursorPaginationQuerySchema, IdParamSchema, ThreadRoundParamSchema, ThreadSlugParamSchema } from '@/core';

import {
  AddParticipantRequestSchema,
  AnalyzePromptRequestSchema,
  ChangelogListResponseSchema,
  CreateCustomRoleRequestSchema,
  CreateThreadRequestSchema,
  CreateUserPresetRequestSchema,
  CustomRoleDetailResponseSchema,
  CustomRoleListResponseSchema,
  DeletedResponseSchema,
  DeleteThreadResponseSchema,
  MessagesListResponseSchema,
  ParticipantDetailResponseSchema,
  PreSearchListResponseSchema,
  PublicThreadSlugsResponseSchema,
  RoundStatusResponseSchema,
  ThreadDetailResponseSchema,
  ThreadListQuerySchema,
  ThreadListResponseSchema,
  ThreadSidebarListResponseSchema,
  ThreadSlugStatusResponseSchema,
  UpdateCustomRoleRequestSchema,
  UpdateParticipantRequestSchema,
  UpdateThreadRequestSchema,
  UpdateThreadResponseSchema,
  UpdateUserPresetRequestSchema,
  UserPresetDetailResponseSchema,
  UserPresetListResponseSchema,
} from './schema';

export const listThreadsRoute = createRoute({
  description: 'Get chat threads for the authenticated user with infinite scroll support',
  method: 'get',
  path: '/chat/threads',
  request: {
    query: ThreadListQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ThreadListResponseSchema },
      },
      description: 'Threads retrieved successfully with pagination cursor',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'List chat threads with cursor pagination',
  tags: ['chat'],
});

export const listSidebarThreadsRoute = createRoute({
  description: 'Lightweight endpoint for sidebar - only essential fields (id, title, slug, previousSlug, isFavorite, isPublic, timestamps)',
  method: 'get',
  path: '/chat/threads/sidebar',
  request: {
    query: ThreadListQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ThreadSidebarListResponseSchema },
      },
      description: 'Sidebar threads retrieved',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'List sidebar threads (lightweight)',
  tags: ['chat'],
});

export const createThreadRoute = createRoute({
  description: 'Create a new chat thread with specified mode and configuration',
  method: 'post',
  path: '/chat/threads',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateThreadRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.FORBIDDEN]: {
      content: {
        'application/json': { schema: ApiErrorResponseSchema },
      },
      description: 'Model access denied - subscription tier insufficient for selected model(s)',
    },
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ThreadDetailResponseSchema },
      },
      description: 'Thread created successfully',
    },
    [HttpStatusCodes.TOO_MANY_REQUESTS]: {
      content: {
        'application/json': { schema: ApiErrorResponseSchema },
      },
      description: 'Thread quota exceeded - upgrade subscription or wait for quota reset',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Create chat thread',
  tags: ['chat'],
});
export const getThreadRoute = createRoute({
  description: 'Get details of a specific chat thread',
  method: 'get',
  path: '/chat/threads/{id}',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ThreadDetailResponseSchema },
      },
      description: 'Thread retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get thread details',
  tags: ['chat'],
});
export const updateThreadRoute = createRoute({
  description: 'Update thread title, mode, status, or metadata',
  method: 'patch',
  path: '/chat/threads/{id}',
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateThreadRequestSchema,
        },
      },
      required: true,
    },
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: UpdateThreadResponseSchema },
      },
      description: 'Thread updated successfully',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Update thread',
  tags: ['chat'],
});
export const deleteThreadRoute = createRoute({
  description: 'Delete a chat thread (soft delete - sets status to deleted)',
  method: 'delete',
  path: '/chat/threads/{id}',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: DeleteThreadResponseSchema,
        },
      },
      description: 'Thread deleted successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Delete thread',
  tags: ['chat'],
});
export const getPublicThreadRoute = createRoute({
  description: 'Get a publicly shared thread without authentication (read-only)',
  method: 'get',
  path: '/chat/public/{slug}',
  request: {
    params: ThreadSlugParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ThreadDetailResponseSchema },
      },
      description: 'Public thread retrieved successfully',
    },
    ...createPublicRouteResponses(),
  },
  summary: 'Get public thread by slug',
  tags: ['chat'],
});

export const listPublicThreadSlugsRoute = createRoute({
  description: 'Get all public thread slugs for SSG/ISR page generation. Returns active public threads only.',
  method: 'get',
  path: '/chat/public/slugs',
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: PublicThreadSlugsResponseSchema },
      },
      description: 'Public thread slugs retrieved successfully',
    },
    ...createPublicRouteResponses(),
  },
  summary: 'List all public thread slugs',
  tags: ['chat'],
});

export const getThreadBySlugRoute = createRoute({
  description: 'Get thread details by slug for the authenticated user (ensures ownership)',
  method: 'get',
  path: '/chat/threads/slug/{slug}',
  request: {
    params: ThreadSlugParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ThreadDetailResponseSchema },
      },
      description: 'Thread retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get thread by slug',
  tags: ['chat'],
});
export const getThreadSlugStatusRoute = createRoute({
  description: 'Lightweight endpoint to check if thread slug has been updated (for polling during AI title generation)',
  method: 'get',
  path: '/chat/threads/{id}/slug-status',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: ThreadSlugStatusResponseSchema,
        },
      },
      description: 'Thread slug status retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get thread slug status',
  tags: ['chat'],
});
export const addParticipantRoute = createRoute({
  description: 'Add an AI model with a role to the thread',
  method: 'post',
  path: '/chat/threads/{id}/participants',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AddParticipantRequestSchema,
        },
      },
      required: true,
    },
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ParticipantDetailResponseSchema },
      },
      description: 'Participant added successfully',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Add participant to thread',
  tags: ['chat'],
});
export const updateParticipantRoute = createRoute({
  description: 'Update participant role, priority, or settings',
  method: 'patch',
  path: '/chat/participants/{id}',
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateParticipantRequestSchema,
        },
      },
      required: true,
    },
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ParticipantDetailResponseSchema },
      },
      description: 'Participant updated successfully',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Update participant',
  tags: ['chat'],
});
export const deleteParticipantRoute = createRoute({
  description: 'Remove a participant from the thread',
  method: 'delete',
  path: '/chat/participants/{id}',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(DeletedResponseSchema),
        },
      },
      description: 'Participant removed successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Remove participant',
  tags: ['chat'],
});
export const getThreadMessagesRoute = createRoute({
  description: 'Retrieve all messages for a thread ordered by creation time',
  method: 'get',
  path: '/chat/threads/{id}/messages',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: MessagesListResponseSchema },
      },
      description: 'Messages retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get thread messages',
  tags: ['chat'],
});
export const getThreadChangelogRoute = createRoute({
  description: 'Retrieve configuration changes (mode, participants) for a thread',
  method: 'get',
  path: '/chat/threads/{id}/changelog',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ChangelogListResponseSchema },
      },
      description: 'Changelog retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get thread configuration changelog',
  tags: ['chat'],
});

/**
 * GET Thread Round Changelog Route
 *
 * ✅ PERF OPTIMIZATION: Returns only changelog entries for a specific round
 * Used for incremental changelog updates after config changes mid-conversation
 * Much more efficient than fetching all changelogs
 */
export const getThreadRoundChangelogRoute = createRoute({
  description: 'Retrieve configuration changes for a specific round. More efficient than fetching all changelogs - used for incremental updates after config changes mid-conversation.',
  method: 'get',
  path: '/chat/threads/{threadId}/rounds/{roundNumber}/changelog',
  request: {
    params: ThreadRoundParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: ChangelogListResponseSchema },
      },
      description: 'Round changelog retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get changelog for a specific round',
  tags: ['chat'],
});

/**
 * POST /chat/analyze - Auto Mode Prompt Analysis (Streaming)
 * Analyzes user prompt and streams optimal model/role/mode configuration
 * Used by Auto Mode feature for intelligent chat setup
 *
 * SSE Events:
 * - start: Analysis started
 * - config: Partial/incremental config update
 * - done: Final config with complete analysis
 * - failed: Error with fallback config
 */
export const analyzePromptRoute = createRoute({
  description: 'Analyzes user prompt and streams optimal participants, mode, and web search settings via SSE based on prompt complexity and user tier.',
  method: 'post',
  path: '/chat/analyze',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AnalyzePromptRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'text/event-stream': {
          schema: z.string().openapi({
            description: 'Server-Sent Events stream with analyze events',
            example: 'event: config\ndata: {"config":{"participants":[...],"mode":"analyzing","enableWebSearch":false}}\n\n',
          }),
        },
      },
      description: 'SSE stream of config updates (events: start, config, done, failed)',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Analyze prompt for auto mode configuration (streaming)',
  tags: ['chat'],
});

export const listCustomRolesRoute = createRoute({
  description: 'Get custom role templates for the authenticated user with infinite scroll support',
  method: 'get',
  path: '/chat/custom-roles',
  request: {
    query: CursorPaginationQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: CustomRoleListResponseSchema },
      },
      description: 'Custom roles retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'List custom roles with cursor pagination',
  tags: ['chat'],
});
export const createCustomRoleRoute = createRoute({
  description: 'Create a new reusable custom role template with system prompt',
  method: 'post',
  path: '/chat/custom-roles',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateCustomRoleRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: CustomRoleDetailResponseSchema },
      },
      description: 'Custom role created successfully',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Create custom role',
  tags: ['chat'],
});
export const getCustomRoleRoute = createRoute({
  description: 'Get details of a specific custom role',
  method: 'get',
  path: '/chat/custom-roles/{id}',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: CustomRoleDetailResponseSchema },
      },
      description: 'Custom role retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get custom role details',
  tags: ['chat'],
});
export const updateCustomRoleRoute = createRoute({
  description: 'Update custom role name, description, system prompt, or metadata',
  method: 'patch',
  path: '/chat/custom-roles/{id}',
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateCustomRoleRequestSchema,
        },
      },
      required: true,
    },
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: CustomRoleDetailResponseSchema },
      },
      description: 'Custom role updated successfully',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Update custom role',
  tags: ['chat'],
});
export const deleteCustomRoleRoute = createRoute({
  description: 'Delete a custom role template',
  method: 'delete',
  path: '/chat/custom-roles/{id}',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(DeletedResponseSchema),
        },
      },
      description: 'Custom role deleted successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Delete custom role',
  tags: ['chat'],
});
export const listUserPresetsRoute = createRoute({
  description: 'Get user-created model presets from localStorage with infinite scroll support',
  method: 'get',
  path: '/chat/user-presets',
  request: {
    query: CursorPaginationQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: UserPresetListResponseSchema },
      },
      description: 'User presets retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'List user presets with cursor pagination',
  tags: ['chat'],
});
export const createUserPresetRoute = createRoute({
  description: 'Create a new user preset with model-role pairs and mode',
  method: 'post',
  path: '/chat/user-presets',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateUserPresetRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: UserPresetDetailResponseSchema },
      },
      description: 'User preset created successfully',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Create user preset',
  tags: ['chat'],
});
export const getUserPresetRoute = createRoute({
  description: 'Get details of a specific user preset',
  method: 'get',
  path: '/chat/user-presets/{id}',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: UserPresetDetailResponseSchema },
      },
      description: 'User preset retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get user preset details',
  tags: ['chat'],
});
export const updateUserPresetRoute = createRoute({
  description: 'Update user preset name, model-role pairs, or mode',
  method: 'patch',
  path: '/chat/user-presets/{id}',
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateUserPresetRequestSchema,
        },
      },
      required: true,
    },
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: UserPresetDetailResponseSchema },
      },
      description: 'User preset updated successfully',
    },
    ...createMutationRouteResponses(),
  },
  summary: 'Update user preset',
  tags: ['chat'],
});
export const deleteUserPresetRoute = createRoute({
  description: 'Delete a user preset from localStorage',
  method: 'delete',
  path: '/chat/user-presets/{id}',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': {
          schema: createApiResponseSchema(DeletedResponseSchema),
        },
      },
      description: 'User preset deleted successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Delete user preset',
  tags: ['chat'],
});
/**
 * GET Round Status Route - Internal queue worker endpoint
 * ✅ FOLLOWS: computeRoundStatus pattern from round-orchestration.service
 * Used by ROUND_ORCHESTRATION_QUEUE worker to determine next action
 */
export const getRoundStatusRoute = createRoute({
  description: 'Internal endpoint for queue workers to determine next action in round orchestration. Returns current round status, participant completion, and what needs to be triggered next.',
  method: 'get',
  path: '/chat/threads/{threadId}/rounds/{roundNumber}/status',
  request: {
    params: ThreadRoundParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: RoundStatusResponseSchema },
      },
      description: 'Round status retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get round execution status (internal)',
  tags: ['chat'],
});

/**
 * GET Thread Pre-Searches Route - List all pre-searches for thread
 * ✅ FOLLOWS: getThreadSummariesRoute pattern
 */
export const getThreadPreSearchesRoute = createRoute({
  description: 'Retrieve all pre-search results for a thread, showing past search results for each round',
  method: 'get',
  path: '/chat/threads/{id}/pre-searches',
  request: {
    params: IdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'application/json': { schema: PreSearchListResponseSchema },
      },
      description: 'Pre-searches retrieved successfully',
    },
    ...createProtectedRouteResponses(),
  },
  summary: 'Get pre-search results for thread',
  tags: ['chat'],
});
