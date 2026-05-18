import { ANONYMOUS_CONFIG } from '@debatekit/shared/config';

import { useSession } from '@/lib/auth/client';

/**
 * Check if current user is anonymous (guest trial).
 * Uses Better Auth session — anonymous users have isAnonymous=true on their user record.
 * Falls back to email domain check to prevent hydration flash when session is loading.
 */
export function useIsAnonymous() {
  const { data: session } = useSession();
  if (session?.user?.isAnonymous === true) {
    return true;
  }
  if (session?.user?.email?.endsWith(`@${ANONYMOUS_CONFIG.EMAIL_DOMAIN}`)) {
    return true;
  }
  return false;
}
