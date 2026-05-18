import { apiKey } from '@better-auth/api-key';
import * as authSchema from '@debatekit/db/tables';
import { ACCOUNT_ABUSE_CONFIG, ANONYMOUS_CONFIG, EMAIL_DOMAIN_CONFIG, getCookieConfig, LOCALHOST_ORIGINS, NodeEnvs } from '@debatekit/shared';
import { EmailTemplateIds } from '@debatekit/shared/enums';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { admin } from 'better-auth/plugins/admin';
import { anonymous } from 'better-auth/plugins/anonymous';
import { magicLink } from 'better-auth/plugins/magic-link';
import { env as workersEnv } from 'cloudflare:workers';
import { z } from 'zod';

import { db } from '@/db';
import { authTracking } from '@/lib/analytics';
import { getApiServerOrigin, getAppBaseUrl, getWebappEnv } from '@/lib/config/base-urls';
import { log } from '@/lib/logger';

import { isEmailBlockedFromSignup, recordAccountDeletion } from '../account-abuse';
import { isAllowedEmailDomain, isRestrictedEnvironment, validateEmailDomain } from '../utils';

/**
 * Per-request waitUntil bridge for database hooks.
 *
 * Better Auth database hooks (session.create.after) fire during auth.handler()
 * but have no access to Hono's executionCtx. Without waitUntil, fire-and-forget
 * promises (PostHog flush) are killed when the Worker sends the response.
 *
 * Set from the Hono auth handler before calling auth.handler().
 * Safe in Workers: single-threaded, one request at a time per isolate.
 */
let currentRequestWaitUntil: ((promise: Promise<unknown>) => void) | null = null;

export function setAuthWaitUntil(waitUntil: (promise: Promise<unknown>) => void) {
  currentRequestWaitUntil = waitUntil;
}

export function clearAuthWaitUntil() {
  currentRequestWaitUntil = null;
}

/**
 * Track user IDs created in the current request so session.create.after
 * can differentiate signup vs login.
 * Safe in Workers: single-threaded, same isolate for the full request.
 */
const recentlyCreatedUserIds = new Set<string>();

/**
 * Cache user info from user.create.after so session.create.after
 * can fire user_signed_up without an extra DB query.
 */
const recentlyCreatedUserInfo = new Map<string, { email: string; name: string | null }>();

/**
 * Auth method detected from the request path in hooks.before.
 * Read by session.create.after for event properties.
 * Safe in Workers: single-threaded, one request at a time per isolate.
 */
let currentRequestAuthMethod: 'email' | 'google' | 'magic_link' | 'api_key' = 'email';

/**
 * Schema for parsing ctx.body when only the email field is needed.
 * Replaces unsafe `ctx.body as { email?: string }` casts.
 */
const EmailBodySchema = z.object({ email: z.string().email().optional() }).optional();

/**
 * Check if running in development mode (NODE_ENV === 'development')
 * Priority: Cloudflare Workers env > process.env
 */
function isDevelopmentMode(): boolean {
  try {
    if (workersEnv.NODE_ENV) {
      return workersEnv.NODE_ENV === NodeEnvs.DEVELOPMENT;
    }
  } catch {
    // Workers env not available
  }
  return process.env.NODE_ENV === NodeEnvs.DEVELOPMENT;
}

/**
 * Get auth secret from Cloudflare Workers bindings or process.env.
 *
 * Priority:
 * 1. Cloudflare Workers env - production/preview
 * 2. process.env - local dev (.env files)
 *
 * @throws Error if no secret is available at runtime (prevents insecure fallback)
 */
function getAuthSecret(): string {
  // 1. Try Cloudflare Workers bindings
  try {
    if (workersEnv.BETTER_AUTH_SECRET) {
      return workersEnv.BETTER_AUTH_SECRET;
    }
  } catch {
    // Workers env not available - continue to fallback
  }

  // 2. Fall back to process.env (local dev .env)
  if (process.env.BETTER_AUTH_SECRET) {
    return process.env.BETTER_AUTH_SECRET;
  }

  // 3. NO FALLBACK - throw error to prevent insecure operation
  throw new Error(
    'BETTER_AUTH_SECRET not found. Set it via wrangler secret (production) or .env (local dev).',
  );
}

/**
 * Get Google OAuth credentials from Cloudflare Workers bindings or process.env.
 *
 * Returns credentials if available, or undefined if not configured.
 * This allows magic link auth to work even without Google OAuth configured.
 *
 * @throws Error in production if credentials are incomplete (one but not both)
 */
function getGoogleOAuthCredentials(): { clientId: string; clientSecret: string } | undefined {
  let clientId: string | undefined;
  let clientSecret: string | undefined;

  // 1. Try Cloudflare Workers bindings
  try {
    if (workersEnv.AUTH_GOOGLE_ID) {
      clientId = workersEnv.AUTH_GOOGLE_ID;
    }
    if (workersEnv.AUTH_GOOGLE_SECRET) {
      clientSecret = workersEnv.AUTH_GOOGLE_SECRET;
    }
  } catch {
    // Workers env not available - continue to fallback
  }

  // 2. Fall back to process.env
  clientId = clientId || process.env.AUTH_GOOGLE_ID;
  clientSecret = clientSecret || process.env.AUTH_GOOGLE_SECRET;

  // 3. Validate credentials - both must be present and non-empty strings
  if (clientId && clientId.length > 0 && clientSecret && clientSecret.length > 0) {
    return { clientId, clientSecret };
  }

  const hasClientId = Boolean(clientId && clientId.length > 0);
  const hasClientSecret = Boolean(clientSecret && clientSecret.length > 0);

  // Neither present - Google OAuth not configured (allowed - use magic link)
  if (!hasClientId && !hasClientSecret) {
    return undefined;
  }

  // One but not both - configuration error
  throw new Error(
    `[Auth] Incomplete Google OAuth configuration. `
    + `AUTH_GOOGLE_ID: ${hasClientId ? 'set' : 'MISSING'}, `
    + `AUTH_GOOGLE_SECRET: ${hasClientSecret ? 'set' : 'MISSING'}. `
    + `Either set both or remove both.`,
  );
}

/**
 * Create Better Auth database adapter
 *
 * IMPORTANT: Better Auth is initialized at module load time (not per-request),
 * so we cannot use getCloudflareContext() here. Instead, we use the global `db`
 * Proxy which creates a new database instance on each property access.
 *
 * This pattern ensures no connection reuse while working within Better Auth's
 * initialization constraints.
 *
 * @see src/db/index.ts - The Proxy pattern implementation
 */
function createAuthAdapter() {
  // For local development: use the db proxy with transactions enabled
  // For Cloudflare Workers: use the db proxy with transactions disabled (D1 limitation)
  return drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      ...authSchema,
      // Explicitly map apiKey table for Better Auth API key plugin
      // Better Auth expects "apikey" (lowercase, no underscore) in the schema object
      apikey: authSchema.apiKey,
    },
    // Disable transactions entirely - D1 doesn't support traditional transactions
    // and Better Auth's transaction callback pattern conflicts with async operations
    // Session operations are atomic at the row level which is sufficient
    transaction: false,
  });
}

/**
 * Get Better Auth base URL from Cloudflare Workers env or process.env.
 * Priority: Cloudflare Workers env > process.env > fallback to API origin
 */
function getBetterAuthUrl(): string {
  // 1. Try Cloudflare Workers bindings (production/preview)
  try {
    if (workersEnv.BETTER_AUTH_URL) {
      return workersEnv.BETTER_AUTH_URL;
    }
  } catch {
    // Workers env not available - continue to fallback
  }

  // 2. Fall back to process.env (local dev)
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }

  // 3. Derive from API server origin
  return getApiServerOrigin();
}

/**
 * Create Better Auth instance with runtime configuration.
 *
 * This function creates the auth instance when called, allowing
 * access to Cloudflare context for secrets.
 */
function createAuth() {
  return betterAuth({
    account: {
      encryptOAuthTokens: true,
    },
    // Security configuration
    advanced: {
      // Background tasks handler for serverless (Cloudflare Workers)
      // @see https://better-auth.com/docs/reference/options — ensures internal
      // fire-and-forget work (e.g. email sending) survives past the response
      backgroundTasks: {
        handler: (promise) => {
          if (currentRequestWaitUntil) {
            currentRequestWaitUntil(promise);
          }
        },
      },
      // Enable cross-subdomain cookies for preview/prod (app-preview.* and api-preview.* share cookies)
      // Local dev uses separate ports on localhost, so no cross-subdomain needed
      crossSubDomainCookies: (() => {
        const { domain } = getCookieConfig(getWebappEnv());
        return domain ? { domain, enabled: true } : { enabled: false };
      })(),
      database: {
        generateId: () => crypto.randomUUID(),
      },
      // Cookie configuration for OAuth flow
      // SameSite=Lax allows OAuth redirects to work properly
      // In prod/preview with HTTPS and cross-subdomain, use 'lax' for OAuth compatibility
      defaultCookieAttributes: {
        path: '/',
        sameSite: 'lax',
        secure: getCookieConfig(getWebappEnv()).secure,
      },
      // IP address headers — Cloudflare edge sets cf-connecting-ip (not spoofable)
      // @see https://better-auth.com/docs/reference/security
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
      },
      // Use secure cookies based on shared cookie config (HTTPS in non-local envs)
      useSecureCookies: getCookieConfig(getWebappEnv()).secure,
    },
    basePath: '/api/auth', // Explicit basePath to match Hono route
    baseURL: getBetterAuthUrl(),
    database: createAuthAdapter(),

    // Database hooks to validate ALL user creation and session creation
    // This catches Google OAuth and any other social provider signups/signins
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            // Track signup/login for ALL auth flows (OAuth, magic link, email/password).
            //
            // Why here instead of hooks.after?
            // Better Auth's OAuth callback and magic-link verify use `throw ctx.redirect(...)`,
            // which bypasses hooks.after entirely (the redirect error is re-thrown before
            // afterHooks run in to-auth-endpoints.mjs). databaseHooks.session.create.after
            // fires reliably for every new session regardless of response type.
            //
            // CRITICAL: This hook MUST be non-blocking (fire-and-forget).
            // Better Auth's runWithAdapter awaits all pending databaseHooks before
            // returning the session. If we await async work here (DB queries, PostHog
            // HTTP flushes), it blocks the OAuth redirect / magic-link redirect and
            // breaks login. Capture synchronous state now, defer all I/O.
            const userId = session.userId;
            if (!userId) {
              return;
            }

            // Capture synchronous state BEFORE the async IIFE (Workers are single-threaded)
            const isNewUser = recentlyCreatedUserIds.has(userId);
            const authMethod = currentRequestAuthMethod;

            // For signups: grab cached info synchronously, then clean up
            let cachedInfo: { email: string; name: string | null } | undefined;
            if (isNewUser) {
              cachedInfo = recentlyCreatedUserInfo.get(userId);
              recentlyCreatedUserIds.delete(userId);
              recentlyCreatedUserInfo.delete(userId);

              // Skip anonymous users
              if (cachedInfo?.email?.endsWith(`@${ANONYMOUS_CONFIG.EMAIL_DOMAIN}`)) {
                return;
              }
            }

            // Deferred async I/O: registered with waitUntil to survive past response.
            // Without waitUntil, Workers kill the isolate after sending the OAuth
            // redirect, and PostHog flush HTTP requests never complete.
            const trackingPromise = (async () => {
              try {
                if (isNewUser) {
                  if (cachedInfo) {
                    await authTracking.userSignedUp({
                      auth_method: authMethod,
                      createdAt: new Date(),
                      email: cachedInfo.email,
                      name: cachedInfo.name,
                      userId,
                    });
                  }
                } else {
                  // Look up user from DB for login tracking
                  const { getDb } = await import('@/db');
                  const { user: userTable } = await import('@debatekit/db/tables');
                  const { eq } = await import('drizzle-orm');
                  const userRecord = await getDb()
                    .select()
                    .from(userTable)
                    .where(eq(userTable.id, userId))
                    .get();

                  if (!userRecord?.email) {
                    return;
                  }

                  // Skip anonymous users
                  if (userRecord.email.endsWith(`@${ANONYMOUS_CONFIG.EMAIL_DOMAIN}`)) {
                    return;
                  }

                  await authTracking.userLoggedIn({
                    auth_method: authMethod,
                    email: userRecord.email,
                    name: userRecord.name,
                    session_id: session.id,
                    userId,
                  });
                }
              } catch (error) {
                log.auth('error', 'PostHog auth tracking failed in session.create.after', {
                  errorMessage: error instanceof Error ? error.message : String(error),
                  sessionId: session.id,
                });
              }
            })();

            // Register with Workers runtime so it survives past the response
            if (currentRequestWaitUntil) {
              currentRequestWaitUntil(trackingPromise);
            }
          },
        },
        update: {
          after: async (session) => {
            // Track session refresh — only fires when Better Auth actually updates
            // the session row (governed by updateAge, not every getSession call).
            if (!session.userId) {
              return;
            }
            const userId = session.userId;
            const sessionId = session.id;
            const refreshPromise = (async () => {
              try {
                await authTracking.sessionRefreshed(userId, sessionId);
              } catch (error) {
                log.auth('error', 'PostHog session refresh tracking failed', {
                  errorMessage: error instanceof Error ? error.message : String(error),
                  sessionId,
                });
              }
            })();
            if (currentRequestWaitUntil) {
              currentRequestWaitUntil(refreshPromise);
            }
          },
        },
      },
      user: {
        create: {
          after: async (user) => {
            // Flag this user as just-created so session.create.after fires user_signed_up
            // instead of user_logged_in.
            recentlyCreatedUserIds.add(user.id);
            recentlyCreatedUserInfo.set(user.id, { email: user.email, name: user.name });

            // Skip onboarding email setup for anonymous users
            if (user.email?.endsWith(`@${ANONYMOUS_CONFIG.EMAIL_DOMAIN}`)) {
              return;
            }

            // Create default email preferences (all categories subscribed)
            try {
              const { createDefaultPreferences } = await import('@/services/email');
              const { getDb } = await import('@/db');
              await createDefaultPreferences(getDb(), user.id);
            } catch (err) {
              log.auth('error', '[Auth] Failed to create email preferences', {
                errorMessage: err instanceof Error ? err.message : String(err),
                userId: user.id,
              });
            }

            // Enqueue welcome email via EMAIL_SENDING_QUEUE
            try {
              const { enqueueEmail } = await import('@/services/email');
              const { getDb } = await import('@/db');
              if (workersEnv.EMAIL_SENDING_QUEUE) {
                await enqueueEmail(getDb(), { EMAIL_SENDING_QUEUE: workersEnv.EMAIL_SENDING_QUEUE }, {
                  category: 'tips',
                  recipientEmail: user.email,
                  subject: 'Welcome to DebateKit',
                  templateId: EmailTemplateIds.ONBOARDING_WELCOME,
                  templateVars: { userName: user.name || '' },
                  userId: user.id,
                });
              }
            } catch (err) {
              log.auth('error', '[Auth] Failed to enqueue welcome email', {
                errorMessage: err instanceof Error ? err.message : String(err),
                userId: user.id,
              });
            }
          },
          before: async (user) => {
            // Check for account abuse (ALL environments)
            if (user.email && await isEmailBlockedFromSignup(user.email)) {
              throw new Error(ACCOUNT_ABUSE_CONFIG.ERROR_MESSAGE);
            }

            // Skip domain validation in production - only restrict preview/local
            if (!isRestrictedEnvironment()) {
              return;
            }

            // Skip domain validation for anonymous users (auto-generated email)
            if (user.email?.endsWith(`@${ANONYMOUS_CONFIG.EMAIL_DOMAIN}`)) {
              return;
            }

            // Validate email domain for all user creation methods
            if (user.email && !isAllowedEmailDomain(user.email)) {
              throw new Error(EMAIL_DOMAIN_CONFIG.ERROR_MESSAGE);
            }
          },
        },
        update: {
          after: async (user) => {
            // Track profile updates (name, image changes via /update-user endpoint).
            // Skip anonymous users and recently-created users (signup fires separately).
            if (recentlyCreatedUserIds.has(user.id)) {
              return;
            }
            if (user.email?.endsWith(`@${ANONYMOUS_CONFIG.EMAIL_DOMAIN}`)) {
              return;
            }

            const userId = user.id;
            const userName = user.name;
            const userImage = user.image;
            const profilePromise = (async () => {
              try {
                // Determine which fields changed by checking non-null updated values
                const fieldsChanged: string[] = [];
                if (userName !== undefined) {
                  fieldsChanged.push('name');
                }
                if (userImage !== undefined) {
                  fieldsChanged.push('image');
                }

                if (fieldsChanged.length > 0) {
                  await authTracking.profileUpdated({
                    fields_changed: fieldsChanged,
                    userId,
                  });
                }
              } catch (error) {
                log.auth('error', 'PostHog profile update tracking failed', {
                  errorMessage: error instanceof Error ? error.message : String(error),
                  userId,
                });
              }
            })();
            if (currentRequestWaitUntil) {
              currentRequestWaitUntil(profilePromise);
            }
          },
        },
      },
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },

    // Email domain restriction for local and preview environments
    // Following official better-auth pattern: https://better-auth.com/docs/concepts/hooks
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        // Email verification and password reset tracking.
        // NOTE: Signup/login tracking moved to databaseHooks.session.create.after
        // because hooks.after is SKIPPED for redirect-based flows (OAuth callback,
        // magic-link verify use `throw ctx.redirect(...)` which bypasses afterHooks).
        try {
          const path = ctx.path;

          // --- Email verification tracking (no session required) ---
          if (path.includes('/send-verification-email')) {
            const body = EmailBodySchema.safeParse(ctx.body);
            if (body.data?.email) {
              await authTracking.emailVerificationSent(body.data.email);
            }
            return;
          }

          if (path.includes('/verify-email')) {
            const session = ctx.context.session;
            if (session?.user) {
              await authTracking.emailVerificationCompleted(session.user.id);
            }
            return;
          }

          // --- Password reset tracking (no session required) ---
          if (path.includes('/forget-password')) {
            const body = EmailBodySchema.safeParse(ctx.body);
            if (body.data?.email) {
              await authTracking.passwordResetRequested(body.data.email);
            }
            return;
          }

          if (path.includes('/reset-password')) {
            const session = ctx.context.session;
            if (session?.user) {
              await authTracking.passwordResetCompleted(session.user.id);
            }
          }
        } catch (error) {
          log.auth('error', 'PostHog auth tracking failed in hooks.after', {
            errorMessage: error instanceof Error ? error.message : String(error),
            path: ctx.path,
          });
        }
      }),
      before: createAuthMiddleware(async (ctx) => {
        // Detect auth method from request path for session.create.after tracking.
        // Must happen in hooks.before because hooks.after is skipped for redirects.
        if (ctx.path.includes('/callback/google')) {
          currentRequestAuthMethod = 'google';
        } else if (ctx.path.includes('/magic-link')) {
          currentRequestAuthMethod = 'magic_link';
        } else {
          currentRequestAuthMethod = 'email';
        }

        // Rate limit anonymous sign-in
        if (ctx.path === '/sign-in/anonymous') {
          const headers = ctx.headers;
          // IP resolution order:
          // 1. cf-connecting-ip (Cloudflare edge, not spoofable)
          // 2. x-forwarded-for first entry (Cloudflare always sets this)
          // 3. x-real-ip (some proxies)
          // 4. Skip rate limiting entirely if IP is unresolvable
          const cfIp = headers?.get('cf-connecting-ip');
          const xff = headers?.get('x-forwarded-for')?.split(',')[0]?.trim();
          const realIp = headers?.get('x-real-ip');
          const ip = cfIp || xff || realIp;

          // Only rate-limit if we can resolve a real IP.
          // Never collapse to a shared bucket — that blocks all anonymous users.
          if (ip) {
            try {
              const { checkAnonymousRateLimit } = await import('@/services/anonymous/anonymous-rate-limit.service');
              await checkAnonymousRateLimit(ip);
            } catch {
              // Return Better Auth-compatible error so it produces 429, not 500.
              // AppError from createError.rateLimit is not understood by Better Auth.
              const { APIError: BetterAuthAPIError } = await import('better-auth/api');
              throw new BetterAuthAPIError('TOO_MANY_REQUESTS', {
                message: 'Too many anonymous sessions. Please try again later or sign in.',
              });
            }
          }
        }

        try {
          // Validate email domain using reusable utility
          // Handles: /sign-up/email, /sign-in/email, /sign-in/magic-link
          validateEmailDomain(ctx);
        } catch (error) {
          // Track failed login attempts for security monitoring
          const isSignInPath = ctx.path.includes('/sign-in');
          if (isSignInPath && error instanceof Error) {
            try {
              const body = EmailBodySchema.safeParse(ctx.body);
              const emailDomain = body.data?.email?.split('@')[1];

              await authTracking.loginFailed({
                auth_method: ctx.path.includes('/magic-link') ? 'magic_link' : 'email',
                email_domain: emailDomain,
                failure_reason: error.message,
              });
            } catch {
              // Don't fail on analytics error
            }
          }

          // Log validation errors for debugging
          log.auth('error', 'Auth hook validation failed', {
            errorMessage: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : 'Unknown',
            path: ctx.path,
          });
          throw error; // Re-throw to let Better Auth handle it
        }
      }),
    },

    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          // Initialize email service with env NOW while still in Workers async context.
          // Better Auth's internal processing can break the cloudflare:workers async context,
          // so we must capture env bindings here before any async work within Better Auth.
          try {
            const { initializeEmailService } = await import('@/lib/email/ses-service');
            initializeEmailService(workersEnv);
          } catch {
            // Workers env not available (local dev) — emailService may already be initialized
          }

          try {
            const { emailService } = await import('@/lib/email/ses-service');
            await emailService.sendMagicLink(email, url, 15);
          } catch (error) {
            // Log detailed error for Cloudflare Workers Logs
            log.auth('error', 'Magic link email failed', {
              emailDomain: email.split('@')[1],
              errorMessage: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : 'Unknown',
              errorStack: error instanceof Error ? error.stack : undefined,
            });
            // Better Auth will show this error to the user
            const errorMessage = error instanceof Error ? error.message : 'Failed to send magic link email';
            throw new Error(`Unable to send login email: ${errorMessage}`);
          }
        },
      }),
      apiKey({
        // API Key Headers - specify which headers to check for API keys
        // Default is 'x-api-key', but can specify multiple headers
        // @see https://www.better-auth.com/docs/plugins/api-key#configure-api-key-headers
        apiKeyHeaders: 'x-api-key', // Can also be array: ['x-api-key', 'authorization']

        // Key configuration
        defaultKeyLength: 64,

        // Custom prefix for API keys (e.g., rpnd_abc123...)
        defaultPrefix: 'rpnd_',
        // Metadata support - allows storing custom data with API keys
        enableMetadata: true,

        // Expiration settings
        keyExpiration: {
          defaultExpiresIn: null, // No expiration by default
          disableCustomExpiresTime: false,
          maxExpiresIn: 365, // Maximum 1 year
          minExpiresIn: 1, // Minimum 1 day
        },

        // Rate limiting configuration
        rateLimit: {
          enabled: true,
          maxRequests: 1000, // 1000 requests per day by default
          timeWindow: 1000 * 60 * 60 * 24, // 24 hours
        },

        requireName: true,

        // Sessions from API keys - enabled by default in Better Auth
        // When a valid API key is found in the specified headers, Better Auth automatically
        // creates a mock session for the user. This allows endpoints using getSession() to
        // work seamlessly with both session cookies and API keys.
        // To disable this behavior, set: disableSessionForAPIKeys: true
        // @see https://www.better-auth.com/docs/plugins/api-key#sessions-from-api-keys
      }),
      admin({
        adminRole: 'admin',
        allowImpersonatingAdmins: true, // Allow admins to impersonate other admins
        defaultRole: 'user',
        impersonationSessionDuration: 60 * 60, // 1 hour
      }),
      anonymous({
        emailDomainName: ANONYMOUS_CONFIG.EMAIL_DOMAIN,
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          // Merge anonymous user data into the newly authenticated account
          try {
            const { mergeAnonymousToAuthenticated } = await import('@/services/anonymous/anonymous.service');
            await mergeAnonymousToAuthenticated(anonymousUser.user.id, newUser.user.id);
            log.auth('info', '[AUTH] Anonymous account linked via Better Auth', {
              anonymousUserId: anonymousUser.user.id,
              authenticatedUserId: newUser.user.id,
            });
          } catch (error) {
            log.auth('error', '[AUTH] Anonymous account link merge failed', {
              anonymousUserId: anonymousUser.user.id,
              authenticatedUserId: newUser.user.id,
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          }
        },
      }),
    ],

    // Rate limiting — enabled by default in production. Explicit config per
    // Better Auth security best practices for sensitive endpoints.
    // @see https://better-auth.com/docs/reference/security
    rateLimit: {
      customRules: {
        '/api/auth/forget-password': { max: 3, window: 60 },
        '/api/auth/sign-in/email': { max: 5, window: 60 },
        '/api/auth/sign-in/magic-link': { max: 5, window: 60 },
        '/api/auth/sign-up/email': { max: 3, window: 60 },
      },
      enabled: true,
      max: 100,
      window: 10,
    },

    secret: getAuthSecret(),

    // Session configuration
    // Default expiresIn is only 7 days — extend to 30 days for normal dashboard usage.
    // updateAge: refresh the DB session expiry every hour during active use.
    // cookieCache: avoid a DB hit on every request by caching session in cookie for 5 min.
    // refreshCache: proactively re-set the session token cookie before the cache expires,
    //   ensuring the browser cookie's maxAge is regularly extended (prevents silent expiry).
    //   Without this, the session token cookie is only updated when the cache expires AND
    //   updateAge is reached — a narrow window that can be missed when Set-Cookie headers
    //   are lost through SSR server functions.
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes (in seconds)
        refreshCache: {
          updateAge: 60, // Refresh when 60s remain before cache expiry (~4 min cycle)
        },
        strategy: 'compact', // Base64url + HMAC — smallest payload
      },
      expiresIn: 30 * 24 * 60 * 60, // 30 days (in seconds)
      freshAge: 60 * 60, // 1 hour — sessions within this window are "fresh" for sensitive actions
      updateAge: 60 * 60, // 1 hour (in seconds) — refresh DB session hourly during active use
    },

    // ✅ Only enable Google OAuth if credentials are configured
    // If not configured, only magic link authentication will be available
    socialProviders: (() => {
      const googleCreds = getGoogleOAuthCredentials();
      return googleCreds
        ? { google: { clientId: googleCreds.clientId, clientSecret: googleCreds.clientSecret, prompt: 'select_account' } }
        : {};
    })(),

    // Trusted origins (TanStack Start: web on 5173, API on 8787)
    trustedOrigins: [
      getAppBaseUrl(),
      ...(isDevelopmentMode() ? LOCALHOST_ORIGINS : []),
    ],

    user: {
      changeEmail: {
        enabled: false, // Disabled for security
      },
      deleteUser: {
        afterDelete: async (user) => {
          // Record deletion to prevent free round abuse
          if (user.email) {
            await recordAccountDeletion(user.email);
          }

          // Track account deletion in PostHog
          try {
            const accountAgeMs = user.createdAt
              ? Date.now() - new Date(user.createdAt).getTime()
              : undefined;
            const accountAgeDays = accountAgeMs
              ? Math.floor(accountAgeMs / (1000 * 60 * 60 * 24))
              : undefined;

            await authTracking.accountDeleted({
              account_age_days: accountAgeDays,
              email: user.email,
              userId: user.id,
            });
          } catch (error) {
            // Don't fail deletion on analytics error
            log.auth('error', 'PostHog account deletion tracking failed', {
              errorMessage: error instanceof Error ? error.message : String(error),
              userId: user.id,
            });
          }
        },
        enabled: true,
      },
    },
  });
}

// Lazy auth instance - created on first access
let _authInstance: ReturnType<typeof createAuth> | null = null;

/**
 * Get the auth instance (lazy initialization).
 *
 * ⚠️ IMPORTANT: This uses lazy initialization to ensure getCloudflareContext()
 * is available when the auth secret is read. The first call to this getter
 * should happen inside a request handler, not at module load time.
 *
 * For per-request auth handling, we use createAuth() directly since
 * it's invoked per-request.
 */
function getAuth() {
  if (!_authInstance) {
    _authInstance = createAuth();
  }
  return _authInstance;
}

/**
 * Auth instance getter - use this for all auth operations.
 *
 * This is a Proxy that lazily initializes the auth instance on first property access.
 * This ensures Cloudflare context is available when reading secrets.
 */
export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
  get(_target, prop) {
    return getAuth()[prop as keyof ReturnType<typeof createAuth>];
  },
});

/**
 * Export createAuth for use cases that need fresh auth per request
 * (e.g., Hono auth route handler)
 */
export { createAuth };
