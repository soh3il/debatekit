import { createFileRoute, redirect } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCreateApiKeyMutation } from '@/hooks/mutations/api-key-mutations';
import { useSession } from '@/lib/auth/client';
import { getMcpBaseUrl } from '@/lib/config/base-urls';
import { useTranslations } from '@/lib/i18n';
import { deleteApiKeyService, listApiKeysService } from '@/services/api/auth/api-keys';

// ============================================================================
// Search Params Schema
// ============================================================================

const mcpAuthorizeSearchSchema = z.object({
  oauth_code: z.string().optional(),
  redirect_uri: z.string().optional(),
  session_id: z.string().optional(),
  state: z.string().optional(),
});

// ============================================================================
// Route Definition
// ============================================================================

export const Route = createFileRoute('/mcp/authorize')({
  validateSearch: mcpAuthorizeSearchSchema,
  beforeLoad: async ({ context, location }) => {
    const { session } = context;

    // If no session or anonymous user, redirect to sign-in with returnTo
    if (!session || session.user.isAnonymous) {
      const returnTo = `${location.pathname}${location.searchStr}`;
      throw redirect({
        search: { redirect: returnTo },
        to: '/auth/sign-in',
      });
    }
  },
  component: McpAuthorizePage,
  head: () => ({
    meta: [
      { title: 'Authorize MCP Access - DebateKit' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
});

// ============================================================================
// Constants
// ============================================================================

/** Timeout for the API key creation mutation (30 seconds) */
const MUTATION_TIMEOUT_MS = 30_000;

/** Name used for MCP-generated API keys — matched for cleanup */
const MCP_KEY_NAME = 'MCP Authorization';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Derive the MCP worker origin from the MCP base URL.
 * getMcpBaseUrl() returns URLs like "https://mcp.debatekit.ai/mcp"
 * but auth callbacks are at the worker root: "/auth/callback"
 */
function getMcpAuthCallbackUrl(): string {
  const mcpUrl = getMcpBaseUrl();
  const parsed = new URL(mcpUrl);
  return `${parsed.origin}/auth/callback`;
}

// ============================================================================
// Component
// ============================================================================

function McpAuthorizePage() {
  const t = useTranslations('mcpAuthorize');
  const { oauth_code: oauthCode, session_id: sessionId, state } = Route.useSearch();
  const { data: session } = useSession();
  const createKeyMutation = useCreateApiKeyMutation();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Validate required params
  const hasValidParams = !!sessionId && !!state;

  const handleApprove = useCallback(async () => {
    if (!sessionId || !state) {
      return;
    }

    // Reset timeout state on retry
    setTimedOut(false);

    // Start timeout timer
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true);
    }, MUTATION_TIMEOUT_MS);

    // Clean up old MCP keys before creating a new one to avoid hitting the 5-key limit.
    // Each MCP auth replaces the previous one — no reason to keep stale keys.
    try {
      const keysResponse = await listApiKeysService();
      if (keysResponse.success && keysResponse.data?.items) {
        const oldMcpKeys = keysResponse.data.items.filter(
          (k: { name?: string | null }) => k.name === MCP_KEY_NAME,
        );
        await Promise.all(
          oldMcpKeys.map((k: { id: string }) =>
            deleteApiKeyService({ param: { keyId: k.id } }),
          ),
        );
      }
    } catch {
      // Cleanup is best-effort — proceed with creation even if it fails
    }

    createKeyMutation.mutate(
      {
        json: {
          name: MCP_KEY_NAME,
        },
      },
      {
        onSuccess: (result) => {
          // Clear timeout on success
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          const apiKeyToken = result?.data?.apiKey?.key;
          if (!apiKeyToken) {
            return;
          }

          setIsRedirecting(true);

          // Build callback URL to MCP server
          const callbackUrl = new URL(getMcpAuthCallbackUrl());
          callbackUrl.searchParams.set('session_id', sessionId);
          callbackUrl.searchParams.set('api_key_token', apiKeyToken);
          callbackUrl.searchParams.set('state', state);
          // Forward OAuth code if this is an OAuth 2.0 flow (Claude Code etc.)
          if (oauthCode) {
            callbackUrl.searchParams.set('oauth_code', oauthCode);
          }

          window.location.href = callbackUrl.toString();
        },
        onError: () => {
          // Clear timeout on error (mutation failed before timeout)
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        },
      },
    );
  }, [sessionId, state, oauthCode, createKeyMutation]);

  const handleDeny = useCallback(() => {
    if (!sessionId || !state) {
      return;
    }

    setIsRedirecting(true);

    // Build callback URL with error
    const callbackUrl = new URL(getMcpAuthCallbackUrl());
    callbackUrl.searchParams.set('session_id', sessionId);
    callbackUrl.searchParams.set('error', 'access_denied');
    callbackUrl.searchParams.set('state', state);
    if (oauthCode) {
      callbackUrl.searchParams.set('oauth_code', oauthCode);
    }

    window.location.href = callbackUrl.toString();
  }, [sessionId, state, oauthCode]);

  // Error state: missing params
  if (!hasValidParams) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <div className="mb-2 rounded-full bg-destructive/10 p-3">
              <Icons.alertCircle className="size-6 text-destructive" />
            </div>
            <CardTitle className="text-lg">{t('error.missingParams')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              {t('error.invalidSession')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirecting state
  if (isRedirecting) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <Icons.loader className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('redirecting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 rounded-full bg-primary/10 p-3">
            <Icons.shieldCheck className="size-6 text-primary" />
          </div>
          <CardTitle className="text-lg">{t('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('description')}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* App identity */}
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-4 py-3">
            <Icons.globe className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('appName')}</span>
            <Badge variant="secondary" className="text-xs">MCP</Badge>
          </div>

          <Separator />

          {/* Permissions */}
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('permissions.title')}</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Icons.check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                <span>{t('permissions.tools')}</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Icons.check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                <span>{t('permissions.credits')}</span>
              </li>
            </ul>
          </div>

          {/* Signed in as */}
          {session?.user?.email && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icons.user className="size-3.5" />
                <span>{session.user.email}</span>
              </div>
            </>
          )}

          {/* Timeout error */}
          {timedOut && (
            <Alert variant="destructive">
              <Icons.alertCircle className="size-4" />
              <AlertTitle>{t('error.createKeyFailed')}</AlertTitle>
              <AlertDescription>
                {t('error.timeout')}
              </AlertDescription>
            </Alert>
          )}

          {/* Error from mutation */}
          {createKeyMutation.isError && !timedOut && (
            <Alert variant="destructive">
              <Icons.alertCircle className="size-4" />
              <AlertTitle>{t('error.createKeyFailed')}</AlertTitle>
              <AlertDescription>
                {createKeyMutation.error.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={createKeyMutation.isPending}
            onClick={handleDeny}
          >
            {t('deny')}
          </Button>
          <Button
            className="flex-1"
            disabled={createKeyMutation.isPending}
            loading={createKeyMutation.isPending}
            onClick={handleApprove}
          >
            {t('approve')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
