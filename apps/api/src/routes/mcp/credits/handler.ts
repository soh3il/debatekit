import type { RouteHandler } from '@hono/zod-openapi';
import { CREDIT_CONFIG } from '@debatekit/shared';
import type { UsageStatus } from '@debatekit/shared/enums';
import { PlanTypes, UsageStatuses } from '@debatekit/shared/enums';

import { createHandler, Responses } from '@/core';
import { getUserCreditBalance } from '@/services/billing';
import type { ApiEnv } from '@/types';

import type { getMcpCreditsRoute } from './route';

// ============================================================================
// Handler
// ============================================================================

export const getMcpCreditsHandler: RouteHandler<
  typeof getMcpCreditsRoute,
  ApiEnv
> = createHandler(
  {
    auth: 'session',
    operationName: 'getMcpCredits',
  },
  async (c) => {
    const { user } = c.auth();

    const creditBalance = await getUserCreditBalance(user.id);

    const available = creditBalance.available;

    const totalAllocation = creditBalance.planType === PlanTypes.PAID
      ? creditBalance.monthlyCredits
      : CREDIT_CONFIG.SIGNUP_CREDITS;

    const percentage = totalAllocation > 0
      ? Math.round(((totalAllocation - creditBalance.balance) / totalAllocation) * 100)
      : 0;

    let status: UsageStatus = UsageStatuses.DEFAULT;
    if (available <= 0) {
      status = UsageStatuses.CRITICAL;
    } else if (percentage >= 80) {
      status = UsageStatuses.WARNING;
    }

    return Responses.ok(c, {
      available,
      balance: creditBalance.balance,
      percentage: Math.min(percentage, 100),
      plan: {
        monthlyCredits: creditBalance.monthlyCredits,
        nextRefillAt: creditBalance.nextRefillAt?.toISOString() ?? null,
        type: creditBalance.planType,
      },
      status,
    });
  },
);
