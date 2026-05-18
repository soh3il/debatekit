/**
 * Projects Services - Domain Barrel Export
 *
 * Single source of truth for all project-related API services
 * Matches backend route structure: /api/v1/projects/*
 */

export {
  // Project operations
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
