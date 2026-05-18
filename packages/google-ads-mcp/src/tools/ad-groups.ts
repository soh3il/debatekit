import type { z } from 'zod';

import { getCustomerId, mutate } from '../google-ads-client.js';
import type { AdGroupCreatePayload, CreateAdGroupSchema } from '../schemas.js';

export async function handleCreateAdGroup(
  input: z.infer<typeof CreateAdGroupSchema>,
): Promise<string> {
  const customerId = getCustomerId(input.customerId);

  const adGroup: AdGroupCreatePayload = {
    name: input.name,
    campaign: input.campaignResourceName,
    type: input.type,
    status: 'ENABLED',
    ...(input.cpcBidMicros ? { cpcBidMicros: input.cpcBidMicros } : {}),
  };

  const result = await mutate(customerId, 'adGroups', [{ create: adGroup }]);
  return JSON.stringify(result, null, 2);
}
