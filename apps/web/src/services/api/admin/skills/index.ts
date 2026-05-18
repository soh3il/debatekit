/**
 * Admin Skills Service
 *
 * Fetches available prompt skills for the {skill_id} autocomplete UI.
 */

import { createApiClient } from '@/lib/api/client';

// Re-export from shared package (single source of truth)
export { type AdminSkill, AdminSkillSchema } from '@debatekit/shared';

// ============================================================================
// Service
// ============================================================================

export async function getAdminSkillsService() {
  const client = createApiClient();
  const res = await client.admin.admin.skills.$get({});
  return res.json();
}
