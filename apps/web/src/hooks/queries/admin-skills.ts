/**
 * Admin Skills Query Hook
 *
 * TanStack Query hook for fetching available prompt skills.
 * Long stale time since skills don't change at runtime.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuthCheck } from '@/hooks/utils';
import { getAdminSkillsService } from '@/services/api/admin/skills';

/**
 * Query hook for fetching admin prompt skills
 */
export function useAdminSkillsQuery() {
  const { isAuthenticated } = useAuthCheck();

  return useQuery({
    enabled: isAuthenticated,
    queryFn: getAdminSkillsService,
    queryKey: ['adminSkills'],
    staleTime: 10 * 60 * 1000, // 10 minutes - skills rarely change
  });
}
