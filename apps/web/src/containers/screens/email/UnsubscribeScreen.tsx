import { EmailCategorySchema } from '@debatekit/shared/enums';
import { Link, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

import { Icons } from '@/components/icons';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  confirmResubscribeService,
  confirmUnsubscribeService,
  validateUnsubscribeService,
} from '@/services/api/email';

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  activity: 'Activity Notification',
  marketing: 'Marketing',
  newsletter: 'Newsletter',
  product_updates: 'Product Update',
  tips: 'Tips & Tutorial',
};

const UNSUBSCRIBE_STATES = {
  ERROR: 'error',
  INVALID: 'invalid',
  LOADING: 'loading',
  RESUBSCRIBED: 'resubscribed',
  SUCCESS: 'success',
  VALID: 'valid',
} as const;

type UnsubscribeState = typeof UNSUBSCRIBE_STATES[keyof typeof UNSUBSCRIBE_STATES];

// ============================================================================
// Component
// ============================================================================

export default function UnsubscribeScreen() {
  const { cat, token, uid } = useSearch({ from: '/email/unsubscribe' });
  const category = EmailCategorySchema.parse(cat);
  const [state, setState] = useState<UnsubscribeState>(UNSUBSCRIBE_STATES.LOADING);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const categoryLabel = CATEGORY_LABELS[category] ?? category;

  // Validate the unsubscribe token on mount
  useEffect(() => {
    let cancelled = false;

    async function validate() {
      try {
        await validateUnsubscribeService({
          query: { category, token, userId: uid },
        });

        if (!cancelled) {
          setState(UNSUBSCRIBE_STATES.VALID);
        }
      } catch {
        if (!cancelled) {
          setState(UNSUBSCRIBE_STATES.INVALID);
        }
      }
    }

    validate();
    return () => {
      cancelled = true;
    };
  }, [category, token, uid]);

  const handleUnsubscribe = useCallback(async () => {
    setState(UNSUBSCRIBE_STATES.LOADING);
    try {
      await confirmUnsubscribeService({
        json: { category, token, userId: uid },
      });
      setState(UNSUBSCRIBE_STATES.SUCCESS);
    } catch (err) {
      setState(UNSUBSCRIBE_STATES.ERROR);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to unsubscribe. Please try again.');
    }
  }, [category, token, uid]);

  const handleResubscribe = useCallback(async () => {
    setState(UNSUBSCRIBE_STATES.LOADING);
    try {
      await confirmResubscribeService({
        json: { category, token, userId: uid },
      });
      setState(UNSUBSCRIBE_STATES.RESUBSCRIBED);
    } catch (err) {
      setState(UNSUBSCRIBE_STATES.ERROR);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resubscribe. Please try again.');
    }
  }, [category, token, uid]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <CardTitle className="text-xl">
            {state === UNSUBSCRIBE_STATES.SUCCESS
              ? 'Unsubscribed'
              : state === UNSUBSCRIBE_STATES.RESUBSCRIBED
                ? 'Resubscribed'
                : 'Unsubscribe'}
          </CardTitle>
          {state === UNSUBSCRIBE_STATES.VALID && (
            <CardDescription>
              You&apos;re unsubscribing from
              {' '}
              {categoryLabel}
              {' '}
              emails
            </CardDescription>
          )}
        </CardHeader>

        <CardContent>
          {state === UNSUBSCRIBE_STATES.LOADING && (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          )}

          {state === UNSUBSCRIBE_STATES.INVALID && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <Icons.triangleAlert className="size-6 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">
                This unsubscribe link is invalid or expired.
              </p>
            </div>
          )}

          {state === UNSUBSCRIBE_STATES.ERROR && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <Icons.alertCircle className="size-6 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">
                {errorMessage}
              </p>
            </div>
          )}

          {state === UNSUBSCRIBE_STATES.VALID && (
            <Button onClick={handleUnsubscribe} className="w-full">
              Confirm Unsubscribe
            </Button>
          )}

          {state === UNSUBSCRIBE_STATES.SUCCESS && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="rounded-full bg-green-500/10 p-3">
                <Icons.checkCircle className="size-6 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                You&apos;ve been successfully unsubscribed from
                {' '}
                {categoryLabel}
                {' '}
                emails.
              </p>
              <Button variant="outline" onClick={handleResubscribe} className="w-full">
                Changed your mind? Resubscribe
              </Button>
            </div>
          )}

          {state === UNSUBSCRIBE_STATES.RESUBSCRIBED && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="rounded-full bg-green-500/10 p-3">
                <Icons.mail className="size-6 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                You&apos;ve been resubscribed to
                {' '}
                {categoryLabel}
                {' '}
                emails.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <Link
            to="/auth/sign-in"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage all email preferences
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
