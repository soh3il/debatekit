/**
 * PostHog Authentication Tracking
 *
 * Auth event capture for Better Auth integration.
 * Uses $set/$set_once for person properties.
 */

import * as z from 'zod';

import { log } from '@/lib/logger';

import { getDistinctIdFromCookie, getPostHogClient } from './posthog-server';

const AUTH_METHOD_VALUES = ['email', 'google', 'github', 'magic_link', 'api_key'] as const;
const AuthMethodSchema = z.enum(AUTH_METHOD_VALUES);

const AUTH_EVENT_TYPE_VALUES = [
  'user_signed_up',
  'user_logged_in',
  'user_logged_out',
  'password_reset_requested',
  'password_reset_completed',
  'email_verification_sent',
  'email_verification_completed',
  'account_deleted',
  'profile_updated',
  'session_refreshed',
  'login_failed',
] as const;
const _AuthEventTypeSchema = z.enum(AUTH_EVENT_TYPE_VALUES);
type AuthEventType = z.infer<typeof _AuthEventTypeSchema>;

const _CaptureAuthOptionsSchema = z.object({
  cookieHeader: z.string().nullable().optional(),
  distinctId: z.string().optional(),
  userId: z.string().optional(),
});

type CaptureAuthOptions = z.infer<typeof _CaptureAuthOptionsSchema>;

const _UserSignedUpPropertiesSchema = z.object({
  auth_method: AuthMethodSchema,
  email_domain: z.string().optional(),
  referral_source: z.string().optional(),
});

type UserSignedUpProperties = z.infer<typeof _UserSignedUpPropertiesSchema>;

const _UserLoggedInPropertiesSchema = z.object({
  auth_method: AuthMethodSchema,
  session_id: z.string().optional(),
});

type UserLoggedInProperties = z.infer<typeof _UserLoggedInPropertiesSchema>;

const _LoginFailedPropertiesSchema = z.object({
  auth_method: AuthMethodSchema,
  email_domain: z.string().optional(),
  failure_reason: z.string(),
  ip_address: z.string().optional(),
});

type LoginFailedProperties = z.infer<typeof _LoginFailedPropertiesSchema>;

const _AccountDeletedPropertiesSchema = z.object({
  account_age_days: z.number().optional(),
  deletion_reason: z.string().optional(),
});

type AccountDeletedProperties = z.infer<typeof _AccountDeletedPropertiesSchema>;

const _ProfileUpdatedPropertiesSchema = z.object({
  fields_changed: z.array(z.string()),
});

type ProfileUpdatedProperties = z.infer<typeof _ProfileUpdatedPropertiesSchema>;

const PostHogPersonPropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

const PostHogPersonPropertiesSchema = z.record(z.string(), PostHogPersonPropertyValueSchema);

const _AuthEventPropertiesSchema = z.object({
  $set: PostHogPersonPropertiesSchema.optional(),
  $set_once: PostHogPersonPropertiesSchema.optional(),
  account_age_days: z.number().optional(),
  auth_method: AuthMethodSchema.optional(),
  deletion_reason: z.string().optional(),
  email_domain: z.string().optional(),
  failure_reason: z.string().optional(),
  fields_changed: z.array(z.string()).optional(),
  fields_changed_count: z.number().optional(),
  ip_address: z.string().optional(),
  referral_source: z.string().optional(),
  session_id: z.string().optional(),
});

type AuthEventProperties = z.infer<typeof _AuthEventPropertiesSchema>;

/** @internal */
async function captureAuthEvent(
  eventType: AuthEventType,
  properties: AuthEventProperties,
  options?: CaptureAuthOptions,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  const distinctId = options?.distinctId
    ?? options?.userId
    ?? (options?.cookieHeader ? getDistinctIdFromCookie(options.cookieHeader) : null)
    ?? 'anonymous';

  posthog.capture({
    distinctId,
    event: eventType,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
    },
  });

  await posthog.flush();

  log.debug(`[PostHog Auth] Captured and flushed ${eventType} for ${distinctId}`);
}

/**
 * Identify a user to PostHog, merging anonymous activity with authenticated user
 */
async function identifyUser(
  userProperties: {
    userId: string;
    email: string;
    name?: string | null;
    createdAt?: Date;
    image?: string | null;
  },
  options?: CaptureAuthOptions,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  const anonymousDistinctId = options?.cookieHeader
    ? getDistinctIdFromCookie(options.cookieHeader)
    : null;

  if (anonymousDistinctId && anonymousDistinctId !== 'anonymous' && anonymousDistinctId !== userProperties.userId) {
    posthog.alias({
      alias: userProperties.userId,
      distinctId: anonymousDistinctId,
    });

    log.debug(`[PostHog Auth] Aliased ${anonymousDistinctId} to ${userProperties.userId}`);
  }

  posthog.identify({
    distinctId: userProperties.userId,
    properties: {
      $set: {
        email: userProperties.email,
        last_seen: new Date().toISOString(),
        ...(userProperties.name && { name: userProperties.name }),
        ...(userProperties.image && { avatar_url: userProperties.image }),
      },
      $set_once: {
        created_at: userProperties.createdAt?.toISOString() ?? new Date().toISOString(),
        email_domain: userProperties.email.split('@')[1],
      },
    },
  });

  await posthog.flush();

  log.debug(`[PostHog Auth] Identified user ${userProperties.userId}`);
}

export const authTracking = {
  accountDeleted: async (
    props: AccountDeletedProperties & {
      userId: string;
      email: string;
    },
    options?: CaptureAuthOptions,
  ): Promise<void> => {
    await captureAuthEvent('account_deleted', {
      account_age_days: props.account_age_days,
      deletion_reason: props.deletion_reason,
      email_domain: props.email.split('@')[1],
    }, { ...options, userId: props.userId });
  },

  emailVerificationCompleted: async (
    userId: string,
    options?: CaptureAuthOptions,
  ): Promise<void> => {
    await captureAuthEvent('email_verification_completed', {
      $set: {
        email_verified: true,
        email_verified_at: new Date().toISOString(),
      },
    }, { ...options, userId });
  },

  emailVerificationSent: async (
    email: string,
    options?: CaptureAuthOptions,
  ): Promise<void> => {
    await captureAuthEvent('email_verification_sent', {
      email_domain: email.split('@')[1],
    }, options);
  },

  loginFailed: async (
    props: LoginFailedProperties,
    options?: CaptureAuthOptions,
  ): Promise<void> => {
    await captureAuthEvent('login_failed', {
      auth_method: props.auth_method,
      email_domain: props.email_domain,
      failure_reason: props.failure_reason,
      ...(props.ip_address && { ip_address: props.ip_address }),
    }, options);
  },

  passwordResetCompleted: async (
    userId: string,
    options?: CaptureAuthOptions,
  ): Promise<void> => {
    await captureAuthEvent('password_reset_completed', {
      $set: {
        password_reset_at: new Date().toISOString(),
      },
    }, { ...options, userId });
  },

  passwordResetRequested: async (
    email: string,
    options?: CaptureAuthOptions,
  ): Promise<void> => {
    await captureAuthEvent('password_reset_requested', {
      email_domain: email.split('@')[1],
    }, options);
  },

  profileUpdated: async (
    props: ProfileUpdatedProperties & { userId: string },
    options?: CaptureAuthOptions,
  ): Promise<void> => {
    await captureAuthEvent('profile_updated', {
      $set: {
        profile_updated_at: new Date().toISOString(),
      },
      fields_changed: props.fields_changed,
      fields_changed_count: props.fields_changed.length,
    }, { ...options, userId: props.userId });
  },

  sessionRefreshed: async (
    userId: string,
    sessionId: string,
    options?: CaptureAuthOptions,
  ): Promise<void> => {
    await captureAuthEvent('session_refreshed', {
      session_id: sessionId,
    }, { ...options, userId });
  },

  userLoggedIn: async (
    props: UserLoggedInProperties & {
      userId: string;
      email: string;
      name?: string | null;
    },
    options?: CaptureAuthOptions,
  ): Promise<void> => {
    await identifyUser({
      email: props.email,
      name: props.name,
      userId: props.userId,
    }, options);

    await captureAuthEvent('user_logged_in', {
      $set: {
        last_login: new Date().toISOString(),
        last_login_method: props.auth_method,
      },
      auth_method: props.auth_method,
      session_id: props.session_id,
    }, { ...options, userId: props.userId });
  },

  userLoggedOut: async (
    userId: string,
    options?: CaptureAuthOptions,
  ): Promise<void> => {
    await captureAuthEvent('user_logged_out', {
      $set: {
        last_logout: new Date().toISOString(),
      },
    }, { ...options, userId });
  },

  userSignedUp: async (
    props: UserSignedUpProperties & {
      userId: string;
      email: string;
      name?: string | null;
      createdAt?: Date;
    },
    options?: CaptureAuthOptions,
  ): Promise<void> => {
    await identifyUser({
      createdAt: props.createdAt,
      email: props.email,
      name: props.name,
      userId: props.userId,
    }, options);

    await captureAuthEvent('user_signed_up', {
      $set: {
        auth_method: props.auth_method,
        signup_completed: true,
      },
      $set_once: {
        signup_date: new Date().toISOString(),
        signup_method: props.auth_method,
        ...(props.referral_source && { referral_source: props.referral_source }),
      },
      auth_method: props.auth_method,
      email_domain: props.email_domain ?? props.email.split('@')[1],
      referral_source: props.referral_source,
    }, { ...options, userId: props.userId });
  },
};
