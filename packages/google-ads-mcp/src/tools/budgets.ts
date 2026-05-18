import type { z } from 'zod';

import { getCustomerId, mutate } from '../google-ads-client.js';
import type { CreateBudgetSchema } from '../schemas.js';

export async function handleCreateBudget(
  input: z.infer<typeof CreateBudgetSchema>,
): Promise<string> {
  const customerId = getCustomerId(input.customerId);
  const result = await mutate(customerId, 'campaignBudgets', [
    {
      create: {
        name: input.name,
        amountMicros: input.amountMicros,
        deliveryMethod: input.deliveryMethod,
      },
    },
  ]);
  return JSON.stringify(result, null, 2);
}
