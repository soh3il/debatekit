import type { z } from 'zod';

import { getCustomerId, mutate } from '../google-ads-client.js';
import type { CreateCampaignSchema, UpdateCampaignStatusSchema } from '../schemas.js';

export async function handleCreateCampaign(
  input: z.infer<typeof CreateCampaignSchema>,
): Promise<string> {
  const customerId = getCustomerId(input.customerId);
  const result = await mutate(customerId, 'campaigns', [
    {
      create: {
        name: input.name,
        advertisingChannelType: input.advertisingChannelType,
        status: input.status,
        campaignBudget: input.budgetResourceName,
      },
    },
  ]);
  return JSON.stringify(result, null, 2);
}

export async function handleUpdateCampaignStatus(
  input: z.infer<typeof UpdateCampaignStatusSchema>,
): Promise<string> {
  const customerId = getCustomerId(input.customerId);
  const result = await mutate(customerId, 'campaigns', [
    {
      update: {
        resourceName: input.campaignResourceName,
        status: input.status,
      },
      updateMask: 'status',
    },
  ]);
  return JSON.stringify(result, null, 2);
}
