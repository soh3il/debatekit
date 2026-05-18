/**
 * API Services - Centralized Domain Exports
 *
 * Single source of truth for all API service functions and types
 * Organized by domain for proper segregation of concerns
 */

// ============================================================================
// Shared Types
// ============================================================================

export {
  type AdminClearUserCacheParams,
  type AdminClearUserCacheResponse,
  adminClearUserCacheService,
  type AdminSearchUserResult,
  adminSearchUserService,
  type AdminSearchUsersParams,
  type AdminSearchUsersResponse,
  // Admin Settings
  type AdminSettings,
  type AdminSettingsResponse,
  // Admin Jobs
  type AutomatedJob,
  type CreateJobParams,
  type CreateJobResponse,
  createJobService,
  // Admin Tweets
  createTweetService,
  type DeleteJobParams,
  type DeleteJobResponse,
  deleteJobService,
  deleteTweetService,
  type DiscoverTrendsData,
  type DiscoverTrendsParams,
  type DiscoverTrendsResponse,
  discoverTrendsService,
  getAdminSettingsService,
  type GetJobParams,
  type GetJobResponse,
  getJobService,
  type ListJobsData,
  type ListJobsParams,
  type ListJobsResponse,
  listJobsService,
  // Admin Pipeline
  type ListPipelineRunsResponse,
  listPipelineRunsService,
  type ListTweetsResponse,
  listTweetsService,
  type PipelineRun,
  type ScheduledTweet,
  sendTweetService,
  type TrendSuggestion,
  type UpdateAdminSettingsParams,
  type UpdateAdminSettingsResponse,
  updateAdminSettingsService,
  type UpdateJobParams,
  type UpdateJobResponse,
  updateJobService,
  updateTweetService,
} from './admin';

// ============================================================================
// Admin Domain Services
// ============================================================================

export {
  type ClearOwnCacheResponse,
  clearOwnCacheService,
  type CreateApiKeyRequest,
  type CreateApiKeyResponse,
  createApiKeyService,
  type DeleteApiKeyRequest,
  type DeleteApiKeyResponse,
  deleteApiKeyService,
  type GetApiKeyRequest,
  type GetApiKeyResponse,
  getApiKeyService,
  type ListApiKeysRequest,
  type ListApiKeysResponse,
  listApiKeysService,
  type UpdateApiKeyRequest,
  type UpdateApiKeyResponse,
  updateApiKeyService,
} from './auth';

// ============================================================================
// Auth Domain Services
// ============================================================================

export {
  type ConfirmResubscribeRequest,
  type ConfirmResubscribeResponse,
  confirmResubscribeService,
  type ConfirmUnsubscribeRequest,
  type ConfirmUnsubscribeResponse,
  confirmUnsubscribeService,
  type GetEmailPreferencesRequest,
  type GetEmailPreferencesResponse,
  getEmailPreferencesService,
  type UpdateEmailPreferencesRequest,
  type UpdateEmailPreferencesResponse,
  updateEmailPreferencesService,
  type ValidateUnsubscribeRequest,
  type ValidateUnsubscribeResponse,
  validateUnsubscribeService,
} from './email';

// ============================================================================
// Email Domain Services
// ============================================================================

export {
  type CancelSubscriptionRequest,
  type CancelSubscriptionResponse,
  cancelSubscriptionService,
  type CreateCheckoutSessionRequest,
  type CreateCheckoutSessionResponse,
  createCheckoutSessionService,
  type CreateCustomerPortalSessionRequest,
  type CreateCustomerPortalSessionResponse,
  createCustomerPortalSessionService,
  type GetProductRequest,
  type GetProductResponse,
  getProductService,
  getProductsService,
  type GetSubscriptionRequest,
  type GetSubscriptionResponse,
  getSubscriptionService,
  getSubscriptionsService,
  type ListProductsResponse,
  type ListSubscriptionsResponse,
  type Price,
  type Product,
  type Subscription,
  type SwitchSubscriptionRequest,
  type SwitchSubscriptionResponse,
  switchSubscriptionService,
  type SyncAfterCheckoutRequest,
  type SyncAfterCheckoutResponse,
  syncAfterCheckoutService,
} from './billing';

// ============================================================================
// Billing Domain Services
// ============================================================================

export {
  getPodcastAudioUrl,
  type GetPodcastEpisodesParams,
  getPodcastEpisodesService,
  type GetPodcastParams,
  getPodcastService,
  getPublicPodcastAudioUrl,
  getPublicPodcastEpisodesService,
  type GetPublicPodcastParams,
  getPublicPodcastService,
  type PodcastData,
  type PodcastEpisodesResponse,
  type PodcastResponse,
  type PodcastScript,
  type PodcastScriptLine,
} from './chat';
export {
  type AddParticipantRequest,
  type AddParticipantResponse,
  addParticipantService,
  type AnalyzePromptRequest,
  type AnalyzePromptResponse,
  analyzePromptStreamService,
  // API-derived types (SINGLE SOURCE OF TRUTH - RPC INFERENCE)
  type ApiChangelog,
  type ApiMessage,
  type ApiMessageMetadata,
  type ApiMessagePart,
  type ApiMessageParts,
  type ApiParticipant,
  // Derived citation/source types
  type AvailableSource,
  type ChangelogItem,
  type ChangelogListData,
  // Derived convenience types
  type ChatParticipant,
  type ChatSidebarItem,
  type ChatThread,
  type ChatThreadChangelog,
  type ChatThreadChangelogFlexible,
  type ChatThreadFlexible,
  type CreateCustomRoleRequest,
  type CreateCustomRoleResponse,
  createCustomRoleService,
  type CreateThreadRequest,
  type CreateThreadResponse,
  createThreadService,
  type CustomRole,
  // Derived metadata types (discriminated union members)
  type DbAssistantMessageMetadata,
  // Derived changelog types
  type DbChangelogData,
  type DbCitation,
  type DbMessageMetadata,
  type DbModeratorMessageMetadata,
  type DbPreSearchMessageMetadata,
  type DbUserMessageMetadata,
  type DeleteCustomRoleRequest,
  type DeleteCustomRoleResponse,
  deleteCustomRoleService,
  type DeleteParticipantRequest,
  type DeleteParticipantResponse,
  deleteParticipantService,
  type DeleteThreadRequest,
  type DeleteThreadResponse,
  deleteThreadService,
  // Pre-search data types
  type GeneratedSearchQuery,
  type GetCustomRoleRequest,
  type GetCustomRoleResponse,
  getCustomRoleService,
  type GetPublicThreadRequest,
  type GetPublicThreadResponse,
  getPublicThreadService,
  type GetThreadBySlugRequest,
  type GetThreadBySlugResponse,
  getThreadBySlugService,
  type GetThreadChangelogRequest,
  type GetThreadChangelogResponse,
  getThreadChangelogService,
  type GetThreadMessagesRequest,
  type GetThreadMessagesResponse,
  getThreadMessagesService,
  type GetThreadPreSearchesRequest,
  type GetThreadPreSearchesResponse,
  getThreadPreSearchesService,
  type GetThreadRequest,
  type GetThreadResponse,
  type GetThreadRoundChangelogRequest,
  type GetThreadRoundChangelogResponse,
  getThreadRoundChangelogService,
  getThreadService,
  type GetThreadSlugStatusRequest,
  type GetThreadSlugStatusResponse,
  getThreadSlugStatusService,
  // NOTE: Stream resumption types/service removed - AI SDK resume: true handles resumption natively
  // Type guards (Pure TypeScript - no Zod)
  isAssistantMessageMetadata,
  isModeChange,
  isModeratorMessageMetadata,
  isParticipantChange,
  isParticipantMessageMetadata,
  isParticipantRoleChange,
  isPreSearchMessageMetadata,
  isUserMessageMetadata,
  isWebSearchChange,
  type ListCustomRolesRequest,
  type ListCustomRolesResponse,
  listCustomRolesService,
  type ListPublicThreadSlugsResponse,
  listPublicThreadSlugsService,
  type ListSidebarThreadsRequest,
  type ListSidebarThreadsResponse,
  listSidebarThreadsService,
  type ListThreadsRequest,
  type ListThreadsResponse,
  listThreadsService,
  type PartialPreSearchData,
  type PreSearchDataPayload,
  type PreSearchQuery,
  type PreSearchResult,
  type PublicThreadData,
  type StoredPreSearch,
  type StoredThread,
  // SSR Streaming State - for partial content rendering on page refresh
  type StreamingState,
  type ThreadDetailData,
  type UpdateCustomRoleRequest,
  type UpdateCustomRoleResponse,
  updateCustomRoleService,
  type UpdateParticipantRequest,
  type UpdateParticipantResponse,
  updateParticipantService,
  type UpdateThreadRequest,
  type UpdateThreadResponse,
  updateThreadService,
  type WebSearchResultItem,
} from './chat';

// ============================================================================
// Presets Domain Services
// ============================================================================

export {
  type GetMcpCreditsResponse,
  getMcpCreditsService,
  type GetMcpHistoryResponse,
  getMcpHistoryService,
  type GetMcpUsageResponse,
  getMcpUsageService,
  type McpCreditsData,
} from './mcp';
export {
  listModelsPublicService,
  type ListModelsResponse,
  listModelsService,
  type Model,
} from './models';

// ============================================================================
// Memory Domain Services
// ============================================================================

export {
  type DeleteProjectMemoryRequest,
  type DeleteProjectMemoryResponse,
  deleteProjectMemoryService,
  type GetProjectMemoryRequest,
  type GetProjectMemoryResponse,
  getProjectMemoryService,
} from './memories';

// ============================================================================
// Projects Domain Services
// ============================================================================

export {
  type CreateUserPresetRequest,
  type CreateUserPresetResponse,
  createUserPresetService,
  type DeleteUserPresetRequest,
  type DeleteUserPresetResponse,
  deleteUserPresetService,
  type GetUserPresetRequest,
  type GetUserPresetResponse,
  getUserPresetService,
  type ListUserPresetsRequest,
  type ListUserPresetsResponse,
  listUserPresetsService,
  type UpdateUserPresetRequest,
  type UpdateUserPresetResponse,
  updateUserPresetService,
  type UserPreset,
} from './presets';

// ============================================================================
// User Presets Domain Services
// ============================================================================

export {
  type AddUploadToProjectRequest,
  type AddUploadToProjectResponse,
  addUploadToProjectService,
  type CreateProjectRequest,
  type CreateProjectResponse,
  createProjectService,
  type DeleteProjectRequest,
  type DeleteProjectResponse,
  deleteProjectService,
  type GetProjectAttachmentRequest,
  type GetProjectAttachmentResponse,
  getProjectAttachmentService,
  type GetProjectContextRequest,
  type GetProjectContextResponse,
  getProjectContextService,
  type GetProjectLimitsResponse,
  getProjectLimitsService,
  type GetProjectRequest,
  type GetProjectResponse,
  getProjectService,
  type ListProjectAttachmentsQuery,
  type ListProjectAttachmentsRequest,
  type ListProjectAttachmentsResponse,
  listProjectAttachmentsService,
  type ListProjectsRequest,
  type ListProjectsResponse,
  listProjectsService,
  type ProjectAttachmentItem,
  type ProjectDetail,
  type ProjectLimits,
  type ProjectListItem,
  type RemoveAttachmentFromProjectRequest,
  type RemoveAttachmentFromProjectResponse,
  removeAttachmentFromProjectService,
  type UpdateProjectAttachmentRequest,
  type UpdateProjectAttachmentResponse,
  updateProjectAttachmentService,
  type UpdateProjectRequest,
  type UpdateProjectResponse,
  updateProjectService,
} from './projects';

// ============================================================================
// Usage Domain Services
// ============================================================================

export type { ServiceOptions } from './types';

// ============================================================================
// Upload Domain Services
// ============================================================================

export {
  type AbortMultipartUploadRequest,
  type AbortMultipartUploadResponse,
  abortMultipartUploadService,
  type CompleteMultipartUploadRequest,
  type CompleteMultipartUploadResponse,
  completeMultipartUploadService,
  type CreateMultipartUploadRequest,
  type CreateMultipartUploadResponse,
  createMultipartUploadService,
  type DeleteAttachmentRequest,
  type DeleteAttachmentResponse,
  deleteAttachmentService,
  type GetAttachmentRequest,
  type GetAttachmentResponse,
  getAttachmentService,
  type GetDownloadUrlRequest,
  type GetDownloadUrlResponse,
  getDownloadUrlService,
  type ListAttachmentsRequest,
  type ListAttachmentsResponse,
  listAttachmentsService,
  type RequestUploadTicketRequest,
  type RequestUploadTicketResponse,
  requestUploadTicketService,
  secureUploadService,
  type UpdateAttachmentRequest,
  type UpdateAttachmentResponse,
  updateAttachmentService,
  type UploadPartResponse,
  uploadPartService,
  type UploadPartServiceInput,
  type UploadWithTicketResponse,
  uploadWithTicketService,
} from './uploads';

// ============================================================================
// Validation Schemas - Re-exported from single sources of truth
// ============================================================================

export {
  type GetUsageStatsResponse,
  getUserUsageStatsService,
} from './usage';

// ============================================================================
// Streaming Validation Schemas - Only for SSE Parsing
// ============================================================================

export {
  type AnalyzePromptPayload,
  AnalyzePromptPayloadSchema,
  type ModeratorPayload,
  ModeratorPayloadSchema,
  PartialPreSearchDataSchema,
  PreSearchDataPayloadSchema,
  PreSearchQuerySchema,
  PreSearchResultSchema,
  type RecommendedParticipant,
  RecommendedParticipantSchema,
  type Usage,
  UsageSchema,
  WebSearchResultItemSchema,
} from '@debatekit/shared/validation';
