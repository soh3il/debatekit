import type { getMcpAuthContext } from 'agents/mcp';
import { z } from 'zod';

const AuthContextPropsSchema = z.object({
  apiKeyHash: z.string().optional(),
  ip: z.string().optional(),
  userId: z.string(),
});

type AuthProps = z.infer<typeof AuthContextPropsSchema>;

export function getAuthUserId(auth: ReturnType<typeof getMcpAuthContext>): string {
  const parsed = AuthContextPropsSchema.safeParse(auth?.props);
  if (!parsed.success) {
    throw new Error('Authentication context is missing or invalid. Ensure the request is authenticated.');
  }
  return parsed.data.userId;
}

export function getAuthProps(auth: ReturnType<typeof getMcpAuthContext>): AuthProps {
  const parsed = AuthContextPropsSchema.safeParse(auth?.props);
  if (!parsed.success) {
    throw new Error('Authentication context is missing or invalid. Ensure the request is authenticated.');
  }
  return parsed.data;
}
