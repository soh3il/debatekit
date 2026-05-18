/**
 * Compute display initials from user name or email.
 * Returns first letter of each word in the name (uppercased),
 * or the first letter of the email, or 'U' as fallback.
 */
export function getUserInitials(
  user: { email?: string | null; name?: string | null } | null | undefined,
): string {
  if (!user?.name && !user?.email) {
    return 'U';
  }
  return user.name
    ? user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
    : user.email?.[0]?.toUpperCase() || 'U';
}
