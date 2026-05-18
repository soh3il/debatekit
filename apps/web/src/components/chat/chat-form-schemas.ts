import type { ChatMode } from '@debatekit/shared';
import { ChatModeSchema, STRING_LIMITS } from '@debatekit/shared';
import { z } from 'zod';

import { ParticipantConfigSchema } from '@/lib/schemas';
import type { CreateCustomRoleRequest, UpdateThreadRequest } from '@/services/api';

const MessageContentSchema = z.string();

type CreateParticipantPayload = {
  modelId: string;
  role?: string | null;
  customRoleId?: string | null;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
};

type CreateThreadPayload = {
  title?: string;
  mode?: ChatMode;
  enableWebSearch?: boolean;
  participants: CreateParticipantPayload[];
  firstMessage: string;
  attachmentIds?: string[];
  projectId?: string | null;
  metadata?: {
    dataSources?: { id: string; config?: Record<string, string> }[];
    moderatorFormat?: string;
    summary?: string;
    tags?: string[];
  };
};

// ============================================================================
// FORM SCHEMAS
// ============================================================================

export const ChatInputFormSchema = z.object({
  dataSources: z.array(z.object({
    config: z.record(z.string(), z.string()).optional(),
    id: z.string(),
  })).optional(),
  enableWebSearch: z.boolean().optional(),
  message: MessageContentSchema,
  mode: ChatModeSchema,
  moderatorFormat: z.string().optional(),
  participants: z.array(ParticipantConfigSchema).min(1, 'At least one participant is required'),
});
export type ChatInputFormData = z.infer<typeof ChatInputFormSchema>;
export const ThreadInputFormSchema = z.object({
  message: MessageContentSchema,
});
export type ThreadInputFormData = z.infer<typeof ThreadInputFormSchema>;
export function toCreateThreadRequest(
  data: ChatInputFormData,
  attachmentIds?: string[],
  projectId?: string,
): CreateThreadPayload {
  // Build metadata from vertical preset data (dataSources, moderatorFormat)
  const metadata: CreateThreadPayload['metadata'] = {};
  if (data.dataSources?.length) {
    metadata.dataSources = data.dataSources;
  }
  if (data.moderatorFormat) {
    metadata.moderatorFormat = data.moderatorFormat;
  }
  const hasMetadata = Object.keys(metadata).length > 0;

  return {
    attachmentIds: attachmentIds && attachmentIds.length > 0 ? attachmentIds : undefined,
    enableWebSearch: data.enableWebSearch ?? false,
    firstMessage: data.message,
    metadata: hasMetadata ? metadata : undefined,
    mode: data.mode,
    participants: data.participants.map((p) => {
      // Conditionally build participant to satisfy exactOptionalPropertyTypes
      const participant: CreateParticipantPayload = {
        modelId: p.modelId,
      };
      if (p.customRoleId !== undefined) {
        participant.customRoleId = p.customRoleId;
      }
      if (p.settings?.maxTokens !== undefined) {
        participant.maxTokens = p.settings.maxTokens;
      }
      if (p.role) {
        participant.role = p.role;
      }
      if (p.settings?.systemPrompt !== undefined) {
        participant.systemPrompt = p.settings.systemPrompt;
      }
      if (p.settings?.temperature !== undefined) {
        participant.temperature = p.settings.temperature;
      }
      return participant;
    }),
    projectId: projectId ?? null,
    title: 'New Chat',
  };
}

// ============================================================================
// RENAME FORM SCHEMA (derived from UpdateThreadRequest RPC type)
// ============================================================================

export const ChatRenameFormSchema = z.object({
  title: z.string().min(STRING_LIMITS.CHAT_TITLE_MIN).max(STRING_LIMITS.CHAT_TITLE_MAX),
});

export type ChatRenameFormValues = z.infer<typeof ChatRenameFormSchema>;

// Compile-time check: form values must be assignable to the RPC request's json body
void (0 as unknown as (
  ChatRenameFormValues extends Pick<NonNullable<UpdateThreadRequest['json']>, 'title'> ? true : never
));

// ============================================================================
// CUSTOM ROLE FORM SCHEMA (derived from CreateCustomRoleRequest RPC type)
// ============================================================================

export const CustomRoleFormSchema = z.object({
  roleName: z.string().min(STRING_LIMITS.ROLE_NAME_MIN).max(STRING_LIMITS.ROLE_NAME_MAX),
});

export type CustomRoleFormValues = z.infer<typeof CustomRoleFormSchema>;

// Compile-time check: form value type must match the RPC request's `name` field
// Form uses `roleName` which maps to API's `name` in the submit handler
void (0 as unknown as (
  CustomRoleFormValues['roleName'] extends NonNullable<CreateCustomRoleRequest['json']>['name'] ? true : never
));
