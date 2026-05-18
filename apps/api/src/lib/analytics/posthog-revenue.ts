/**
 * PostHog Revenue Tracking
 *
 * Revenue event capture for Stripe webhook integration.
 * Uses PostHog Revenue Analytics format ($revenue, currency, product).
 */

import { BillingIntervalSchema, StripeSubscriptionStatusSchema } from '@debatekit/shared/enums';
import * as z from 'zod';

import { log } from '@/lib/logger';

import { getDistinctIdFromCookie, getPostHogClient } from './posthog-server';

const REVENUE_EVENT_TYPE_VALUES = [
  'subscription_started',
  'subscription_renewed',
  'subscription_upgraded',
  'subscription_downgraded',
  'subscription_canceled',
  'credits_purchased',
  'payment_failed',
  'refund_issued',
] as const;
const _RevenueEventTypeSchema = z.enum(REVENUE_EVENT_TYPE_VALUES);
type RevenueEventType = z.infer<typeof _RevenueEventTypeSchema>;

const BILLING_FUNNEL_EVENT_TYPE_VALUES = [
  'checkout_initiated',
  'checkout_completed',
  'checkout_abandoned',
  'upgrade_prompt_shown',
  'upgrade_prompt_clicked',
  'pricing_page_viewed',
] as const;
const _BillingFunnelEventTypeSchema = z.enum(BILLING_FUNNEL_EVENT_TYPE_VALUES);
type BillingFunnelEventType = z.infer<typeof _BillingFunnelEventTypeSchema>;

const CREDIT_EVENT_TYPE_VALUES = [
  'credits_balance_low',
  'credits_depleted',
  'credits_insufficient_error',
  'credits_refilled',
] as const;
const _CreditEventTypeSchema = z.enum(CREDIT_EVENT_TYPE_VALUES);
type CreditEventType = z.infer<typeof _CreditEventTypeSchema>;

const _RevenueEventPropertiesSchema = z.object({
  coupon: z.string().optional(),
  currency: z.string(),
  interval: BillingIntervalSchema.optional(),
  invoice_id: z.string().optional(),
  lifetime_value: z.number().optional(),
  price_id: z.string().optional(),
  product: z.string().optional(),
  revenue: z.number(),
  subscription_id: z.string().optional(),
  subscription_status: StripeSubscriptionStatusSchema.optional(),
  total_revenue: z.number().optional(),
});
type RevenueEventProperties = z.infer<typeof _RevenueEventPropertiesSchema>;

const _CaptureRevenueOptionsSchema = z.object({
  cookieHeader: z.string().nullable().optional(),
  customerId: z.string().optional(),
  distinctId: z.string().optional(),
  userId: z.string().optional(),
});
type CaptureRevenueOptions = z.infer<typeof _CaptureRevenueOptionsSchema>;

const _BillingFunnelPropertiesSchema = z.object({
  checkout_session_id: z.string().optional(),
  currency: z.string().optional(),
  interval: BillingIntervalSchema.optional(),
  price_id: z.string().optional(),
  product: z.string().optional(),
  source: z.string().optional(),
  unit_amount: z.number().optional(),
});
type BillingFunnelProperties = z.infer<typeof _BillingFunnelPropertiesSchema>;

const _CreditEventPropertiesSchema = z.object({
  action_type: z.string().optional(),
  credits_refilled: z.number().optional(),
  current_balance: z.number(),
  plan_type: z.string().optional(),
  required_credits: z.number().optional(),
  subscription_tier: z.string().optional(),
  threshold: z.number().optional(),
});
type CreditEventProperties = z.infer<typeof _CreditEventPropertiesSchema>;

// ============================================================================
// Extended Schemas for Revenue Tracking Methods
// ============================================================================

const _CreditsPurchasedPropsSchema = _RevenueEventPropertiesSchema.extend({
  credits_amount: z.number().optional(),
});
type CreditsPurchasedProps = z.infer<typeof _CreditsPurchasedPropsSchema>;

const _PaymentFailedPropsSchema = _RevenueEventPropertiesSchema.partial().extend({
  currency: z.string().optional(),
  error_message: z.string().optional(),
});
type PaymentFailedProps = z.infer<typeof _PaymentFailedPropsSchema>;

const _RefundIssuedPropsSchema = _RevenueEventPropertiesSchema.extend({
  refund_reason: z.string().optional(),
});
type RefundIssuedProps = z.infer<typeof _RefundIssuedPropsSchema>;

const _SubscriptionCanceledPropsSchema = _RevenueEventPropertiesSchema.partial().extend({
  currency: z.string().optional(),
  subscription_id: z.string(),
});
type SubscriptionCanceledProps = z.infer<typeof _SubscriptionCanceledPropsSchema>;

const _SubscriptionChangedPropsSchema = _RevenueEventPropertiesSchema.extend({
  previous_product: z.string().optional(),
});
type SubscriptionChangedProps = z.infer<typeof _SubscriptionChangedPropsSchema>;

const _SubscriptionStartedPropsSchema = _RevenueEventPropertiesSchema.omit({ currency: true, revenue: true }).extend({
  currency: z.string(),
  revenue: z.number(),
});
type SubscriptionStartedProps = z.infer<typeof _SubscriptionStartedPropsSchema>;

// ============================================================================
// Extended Schemas for Billing Funnel Methods
// ============================================================================

const _CheckoutAbandonedPropsSchema = _BillingFunnelPropertiesSchema.extend({
  reason: z.string().optional(),
});
type CheckoutAbandonedProps = z.infer<typeof _CheckoutAbandonedPropsSchema>;

const _CheckoutCompletedPropsSchema = _BillingFunnelPropertiesSchema.extend({
  subscription_id: z.string().optional(),
});
type CheckoutCompletedProps = z.infer<typeof _CheckoutCompletedPropsSchema>;

const _UpgradePromptClickedPropsSchema = _BillingFunnelPropertiesSchema.partial().extend({
  prompt_location: z.string().optional(),
});
type UpgradePromptClickedProps = z.infer<typeof _UpgradePromptClickedPropsSchema>;

const _UpgradePromptShownPropsSchema = _BillingFunnelPropertiesSchema.partial().extend({
  prompt_location: z.string().optional(),
  reason: z.string().optional(),
});
type UpgradePromptShownProps = z.infer<typeof _UpgradePromptShownPropsSchema>;

// ============================================================================
// Extended Schemas for Credit Tracking Methods
// ============================================================================

const _CreditsInsufficientPropsSchema = _CreditEventPropertiesSchema.extend({
  action_type: z.string().optional(),
  required_credits: z.number(),
  subscription_tier: z.string().optional(),
});
type CreditsInsufficientProps = z.infer<typeof _CreditsInsufficientPropsSchema>;

async function captureRevenueEvent(
  eventType: RevenueEventType,
  properties: RevenueEventProperties,
  options?: CaptureRevenueOptions,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  const distinctId = options?.distinctId
    ?? options?.userId
    ?? (options?.cookieHeader ? getDistinctIdFromCookie(options.cookieHeader) : null)
    ?? options?.customerId
    ?? 'anonymous';

  posthog.capture({
    distinctId,
    event: eventType,
    properties: {
      $revenue: properties.revenue,
      $set: {
        last_billing_date: new Date().toISOString(),
        last_billing_event: eventType,
        ...(properties.product && { current_plan: properties.product }),
        ...(properties.subscription_id && { stripe_subscription_id: properties.subscription_id }),
        ...(properties.subscription_status && { subscription_status: properties.subscription_status }),
        ...(properties.total_revenue !== undefined && { total_revenue: properties.total_revenue }),
        ...(properties.lifetime_value !== undefined && { lifetime_value: properties.lifetime_value }),
      },
      $set_once: {
        first_purchase_date: new Date().toISOString(),
        ...(options?.customerId && { stripe_customer_id: options.customerId }),
        ...(eventType === 'subscription_started' && { subscription_started_at: new Date().toISOString() }),
      },
      billing_interval: properties.interval,
      coupon: properties.coupon,
      currency: properties.currency,
      product: properties.product,
      revenue: properties.revenue,
      stripe_invoice_id: properties.invoice_id,
      stripe_price_id: properties.price_id,
      subscription_id: properties.subscription_id,
    },
  });

  await posthog.flush();

  log.debug(`[PostHog Revenue] Captured and flushed ${eventType} for ${distinctId} - revenue: ${properties.revenue} ${properties.currency}`);
}

export const revenueTracking = {
  creditsPurchased: async (
    props: CreditsPurchasedProps,
    options?: CaptureRevenueOptions,
  ) => await captureRevenueEvent('credits_purchased', props, options),

  paymentFailed: async (
    props: PaymentFailedProps,
    options?: CaptureRevenueOptions,
  ) => await captureRevenueEvent('payment_failed', {
    currency: props.currency ?? 'USD',
    revenue: 0,
    ...props,
  }, options),

  refundIssued: async (
    props: RefundIssuedProps,
    options?: CaptureRevenueOptions,
  ) => await captureRevenueEvent('refund_issued', {
    ...props,
    revenue: -Math.abs(props.revenue),
  }, options),

  subscriptionCanceled: async (
    props: SubscriptionCanceledProps,
    options?: CaptureRevenueOptions,
  ) => {
    const posthog = getPostHogClient();
    if (!posthog) {
      return;
    }

    const distinctId = options?.distinctId
      ?? options?.userId
      ?? (options?.cookieHeader ? getDistinctIdFromCookie(options.cookieHeader) : null)
      ?? options?.customerId
      ?? 'anonymous';

    posthog.capture({
      distinctId,
      event: 'subscription_canceled',
      properties: {
        $revenue: 0,
        $set: {
          last_billing_date: new Date().toISOString(),
          last_billing_event: 'subscription_canceled',
          subscription_canceled_at: new Date().toISOString(),
          subscription_status: 'canceled',
          ...(props.product && { current_plan: props.product }),
        },
        currency: props.currency ?? 'USD',
        product: props.product,
        revenue: 0,
        subscription_id: props.subscription_id,
      },
    });

    await posthog.flush();
    log.debug(`[PostHog Revenue] Captured and flushed subscription_canceled for ${distinctId}`);
  },

  subscriptionDowngraded: async (
    props: SubscriptionChangedProps,
    options?: CaptureRevenueOptions,
  ) => await captureRevenueEvent('subscription_downgraded', props, options),

  subscriptionRenewed: async (
    props: RevenueEventProperties,
    options?: CaptureRevenueOptions,
  ) => await captureRevenueEvent('subscription_renewed', props, options),

  subscriptionStarted: async (
    props: SubscriptionStartedProps,
    options?: CaptureRevenueOptions,
  ) => await captureRevenueEvent('subscription_started', props, options),

  subscriptionUpgraded: async (
    props: SubscriptionChangedProps,
    options?: CaptureRevenueOptions,
  ) => await captureRevenueEvent('subscription_upgraded', props, options),
};

async function captureBillingFunnelEvent(
  eventType: BillingFunnelEventType,
  properties: BillingFunnelProperties,
  options?: CaptureRevenueOptions,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  const distinctId = options?.distinctId
    ?? options?.userId
    ?? (options?.cookieHeader ? getDistinctIdFromCookie(options.cookieHeader) : null)
    ?? options?.customerId
    ?? 'anonymous';

  posthog.capture({
    distinctId,
    event: eventType,
    properties: {
      $set: {
        last_billing_funnel_date: new Date().toISOString(),
        last_billing_funnel_event: eventType,
        ...(properties.product && { interested_in_product: properties.product }),
      },
      checkout_session_id: properties.checkout_session_id,
      currency: properties.currency,
      interval: properties.interval,
      price_id: properties.price_id,
      product: properties.product,
      source: properties.source,
      unit_amount: properties.unit_amount,
    },
  });

  await posthog.flush();

  log.debug(`[PostHog Billing] Captured and flushed ${eventType} for ${distinctId}`);
}

export const billingFunnelTracking = {
  checkoutAbandoned: async (
    props: CheckoutAbandonedProps,
    options?: CaptureRevenueOptions,
  ) => await captureBillingFunnelEvent('checkout_abandoned', props, options),

  checkoutCompleted: async (
    props: CheckoutCompletedProps,
    options?: CaptureRevenueOptions,
  ) => await captureBillingFunnelEvent('checkout_completed', props, options),

  checkoutInitiated: async (
    props: BillingFunnelProperties,
    options?: CaptureRevenueOptions,
  ) => await captureBillingFunnelEvent('checkout_initiated', props, options),

  pricingPageViewed: async (
    props: Partial<BillingFunnelProperties>,
    options?: CaptureRevenueOptions,
  ) => await captureBillingFunnelEvent('pricing_page_viewed', {
    ...props,
  }, options),

  upgradePromptClicked: async (
    props: UpgradePromptClickedProps,
    options?: CaptureRevenueOptions,
  ) => await captureBillingFunnelEvent('upgrade_prompt_clicked', {
    ...props,
  }, options),

  upgradePromptShown: async (
    props: UpgradePromptShownProps,
    options?: CaptureRevenueOptions,
  ) => await captureBillingFunnelEvent('upgrade_prompt_shown', {
    ...props,
  }, options),
};

async function captureCreditEvent(
  eventType: CreditEventType,
  properties: CreditEventProperties,
  options?: CaptureRevenueOptions,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  const distinctId = options?.distinctId
    ?? options?.userId
    ?? (options?.cookieHeader ? getDistinctIdFromCookie(options.cookieHeader) : null)
    ?? options?.customerId
    ?? 'anonymous';

  posthog.capture({
    distinctId,
    event: eventType,
    properties: {
      $set: {
        credit_balance: properties.current_balance,
        last_credit_event: eventType,
        last_credit_event_date: new Date().toISOString(),
        ...(properties.plan_type && { plan_type: properties.plan_type }),
      },
      credits_refilled: properties.credits_refilled,
      current_balance: properties.current_balance,
      plan_type: properties.plan_type,
      threshold: properties.threshold,
    },
  });

  await posthog.flush();

  log.debug(`[PostHog Credits] Captured and flushed ${eventType} for ${distinctId} - balance: ${properties.current_balance}`);
}

export const creditTracking = {
  balanceLow: async (
    props: CreditEventProperties,
    options?: CaptureRevenueOptions,
  ) => await captureCreditEvent('credits_balance_low', props, options),

  creditsInsufficientError: async (
    props: CreditsInsufficientProps,
    options?: CaptureRevenueOptions,
  ) => await captureCreditEvent('credits_insufficient_error', props, options),

  creditsRefilled: async (
    props: CreditEventProperties,
    options?: CaptureRevenueOptions,
  ) => await captureCreditEvent('credits_refilled', props, options),

  depleted: async (
    props: CreditEventProperties,
    options?: CaptureRevenueOptions,
  ) => await captureCreditEvent('credits_depleted', props, options),
};

// ============================================================================
// Trial Lifecycle Tracking
// ============================================================================

const TRIAL_LIFECYCLE_EVENT_TYPE_VALUES = [
  'trial_started',
  'trial_ended_converted',
  'trial_ended_expired',
  'subscription_reactivated',
] as const;
const _TrialLifecycleEventTypeSchema = z.enum(TRIAL_LIFECYCLE_EVENT_TYPE_VALUES);
type TrialLifecycleEventType = z.infer<typeof _TrialLifecycleEventTypeSchema>;

const _TrialLifecyclePropertiesSchema = z.object({
  cancellation_duration_days: z.number().optional(),
  product: z.string().optional(),
  subscription_id: z.string(),
  subscription_tier: z.string().optional(),
  trial_duration_days: z.number().optional(),
  trial_end_date: z.string().optional(),
});
type TrialLifecycleProperties = z.infer<typeof _TrialLifecyclePropertiesSchema>;

const _SubscriptionReactivatedPropsSchema = _TrialLifecyclePropertiesSchema.extend({
  cancellation_duration_days: z.number(),
});
type SubscriptionReactivatedProps = z.infer<typeof _SubscriptionReactivatedPropsSchema>;

const _TrialEndedPropsSchema = _TrialLifecyclePropertiesSchema.extend({
  trial_duration_days: z.number(),
});
type TrialEndedProps = z.infer<typeof _TrialEndedPropsSchema>;

const _TrialStartedPropsSchema = _TrialLifecyclePropertiesSchema.extend({
  trial_end_date: z.string(),
});
type TrialStartedProps = z.infer<typeof _TrialStartedPropsSchema>;

async function captureTrialLifecycleEvent(
  eventType: TrialLifecycleEventType,
  properties: TrialLifecycleProperties,
  options?: CaptureRevenueOptions,
): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) {
    return;
  }

  const distinctId = options?.distinctId
    ?? options?.userId
    ?? (options?.cookieHeader ? getDistinctIdFromCookie(options.cookieHeader) : null)
    ?? options?.customerId
    ?? 'anonymous';

  posthog.capture({
    distinctId,
    event: eventType,
    properties: {
      $set: {
        last_trial_event: eventType,
        last_trial_event_date: new Date().toISOString(),
        ...(properties.subscription_tier && { subscription_tier: properties.subscription_tier }),
        ...(eventType === 'trial_started' && { trial_started_at: new Date().toISOString() }),
        ...(eventType === 'trial_ended_converted' && { trial_converted_at: new Date().toISOString() }),
        ...(eventType === 'subscription_reactivated' && { subscription_reactivated_at: new Date().toISOString() }),
      },
      $set_once: {
        ...(eventType === 'trial_started' && { first_trial_start_date: new Date().toISOString() }),
      },
      cancellation_duration_days: properties.cancellation_duration_days,
      product: properties.product,
      subscription_id: properties.subscription_id,
      subscription_tier: properties.subscription_tier,
      trial_duration_days: properties.trial_duration_days,
      trial_end_date: properties.trial_end_date,
    },
  });

  await posthog.flush();

  log.debug(`[PostHog Trial] Captured and flushed ${eventType} for ${distinctId} - subscription: ${properties.subscription_id}`);
}

export const trialLifecycleTracking = {
  subscriptionReactivated: async (
    props: SubscriptionReactivatedProps,
    options?: CaptureRevenueOptions,
  ) => await captureTrialLifecycleEvent('subscription_reactivated', props, options),

  trialEndedConverted: async (
    props: TrialEndedProps,
    options?: CaptureRevenueOptions,
  ) => await captureTrialLifecycleEvent('trial_ended_converted', props, options),

  trialEndedExpired: async (
    props: TrialEndedProps,
    options?: CaptureRevenueOptions,
  ) => await captureTrialLifecycleEvent('trial_ended_expired', props, options),

  trialStarted: async (
    props: TrialStartedProps,
    options?: CaptureRevenueOptions,
  ) => await captureTrialLifecycleEvent('trial_started', props, options),
};
