/**
 * Memory Services - Domain Barrel Export
 *
 * Single source of truth for all memory-related API services
 * Matches backend route structure: /projects/{id}/memory
 */

export {
  type DeleteProjectMemoryRequest,
  type DeleteProjectMemoryResponse,
  deleteProjectMemoryService,
  type ExtractProjectMemoryRequest,
  type ExtractProjectMemoryResponse,
  extractProjectMemoryService,
  type GetProjectMemoryRequest,
  type GetProjectMemoryResponse,
  getProjectMemoryService,
  type RestoreProjectMemoryRequest,
  type RestoreProjectMemoryResponse,
  restoreProjectMemoryService,
} from './memories';
