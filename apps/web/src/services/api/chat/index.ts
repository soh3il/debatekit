/**
 * Chat Services - Domain Barrel Export
 *
 * Single source of truth for all chat-related API services
 * Matches backend route structure: /api/v1/chat/*
 */

// Podcast
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
} from './podcast';

// Participants
export {
  type AddParticipantRequest,
  type AddParticipantResponse,
  addParticipantService,
  type DeleteParticipantRequest,
  type DeleteParticipantResponse,
  deleteParticipantService,
  type UpdateParticipantRequest,
  type UpdateParticipantResponse,
  updateParticipantService,
} from './participants';

// Pre-Search
export {
  type GeneratedSearchQuery,
  type GetThreadPreSearchesRequest,
  type GetThreadPreSearchesResponse,
  getThreadPreSearchesService,
  type PartialPreSearchData,
  type PreSearchDataPayload,
  type PreSearchQuery,
  type PreSearchResult,
  type StoredPreSearch,
  StoredPreSearchSchema,
  type StoredPreSearchValidated,
  type WebSearchResultItem,
} from './pre-search';

// Custom Roles
export {
  type CreateCustomRoleRequest,
  type CreateCustomRoleResponse,
  createCustomRoleService,
  type CustomRole,
  type DeleteCustomRoleRequest,
  type DeleteCustomRoleResponse,
  deleteCustomRoleService,
  type GetCustomRoleRequest,
  type GetCustomRoleResponse,
  getCustomRoleService,
  type ListCustomRolesRequest,
  type ListCustomRolesResponse,
  listCustomRolesService,
  type UpdateCustomRoleRequest,
  type UpdateCustomRoleResponse,
  updateCustomRoleService,
} from './roles';

// Messages (message types, metadata, type guards)
export {
  type ApiMessage,
  type ApiMessageMetadata,
  type ApiMessagePart,
  type ApiMessageParts,
  type AvailableSource,
  type DbAssistantMessageMetadata,
  type DbCitation,
  type DbMessageMetadata,
  type DbModeratorMessageMetadata,
  type DbPreSearchMessageMetadata,
  type DbUserMessageMetadata,
  isAssistantMessageMetadata,
  isModeratorMessageMetadata,
  isParticipantMessageMetadata,
  isPreSearchMessageMetadata,
  isUserMessageMetadata,
  type ParticipantMessageMetadata,
  type StreamingState,
} from './messages';

// Threads (CRUD, changelog, type guards for changelog)
export {
  type AnalyzePromptRequest,
  type AnalyzePromptResponse,
  analyzePromptStreamService,
  // Type extractions derived from API response (SINGLE SOURCE OF TRUTH)
  type ApiChangelog,
  type ApiParticipant,
  type ChangelogItem,
  type ChangelogListData,
  // Derived convenience types
  type ChatParticipant,
  type ChatSidebarItem,
  type ChatThread,
  type ChatThreadChangelog,
  type ChatThreadChangelogFlexible,
  type ChatThreadFlexible,
  type CreateThreadRequest,
  type CreateThreadResponse,
  createThreadService,
  // Derived changelog types
  type DbChangelogData,
  type DeleteThreadRequest,
  type DeleteThreadResponse,
  deleteThreadService,
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
  type GetThreadRequest,
  type GetThreadResponse,
  type GetThreadRoundChangelogRequest,
  type GetThreadRoundChangelogResponse,
  getThreadRoundChangelogService,
  getThreadService,
  type GetThreadSlugStatusRequest,
  type GetThreadSlugStatusResponse,
  getThreadSlugStatusService,
  // Changelog type guards
  isModeChange,
  isParticipantChange,
  isParticipantReorder,
  isParticipantRoleChange,
  isWebSearchChange,
  // NOTE: Stream resumption types/service removed - AI SDK resume: true handles resumption natively
  type ListPublicThreadSlugsResponse,
  listPublicThreadSlugsService,
  type ListSidebarThreadsRequest,
  type ListSidebarThreadsResponse,
  listSidebarThreadsService,
  type ListThreadsRequest,
  type ListThreadsResponse,
  listThreadsService,
  type PublicThreadData,
  type StoredThread,
  type ThreadDetailData,
  type UpdateThreadRequest,
  type UpdateThreadResponse,
  updateThreadService,
} from './threads';
