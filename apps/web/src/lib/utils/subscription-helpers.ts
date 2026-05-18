import { StripeSubscriptionStatuses, StripeSubscriptionStatusSchema } from '@debatekit/shared';
import { z } from 'zod';

/**
 * Minimal schema for subscription status validation.
 * Validates the two fields needed for active-subscription checks
 * without requiring the full Subscription shape.
 */
const SubscriptionActiveCheckSchema = z.object({
  cancelAtPeriodEnd: z.boolean(),
  status: StripeSubscriptionStatusSchema,
});

export function isSubscriptionActive(subscription: unknown): boolean {
  const parsed = SubscriptionActiveCheckSchema.safeParse(subscription);
  if (!parsed.success) {
    return false;
  }

  const { cancelAtPeriodEnd, status } = parsed.data;

  const isActive = status === StripeSubscriptionStatuses.ACTIVE
    || status === StripeSubscriptionStatuses.TRIALING;
  const notCanceling = !cancelAtPeriodEnd;

  return isActive && notCanceling;
}
