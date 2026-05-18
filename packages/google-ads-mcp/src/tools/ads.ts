import type { z } from 'zod';

import { getCustomerId, mutate } from '../google-ads-client.js';
import type { AdGroupAdCreatePayload, CreateResponsiveSearchAdSchema } from '../schemas.js';

export async function handleCreateResponsiveSearchAd(
  input: z.infer<typeof CreateResponsiveSearchAdSchema>,
): Promise<string> {
  const customerId = getCustomerId(input.customerId);

  const ad: AdGroupAdCreatePayload = {
    adGroup: input.adGroupResourceName,
    ad: {
      responsiveSearchAd: {
        headlines: input.headlines.map(text => ({ text })),
        descriptions: input.descriptions.map(text => ({ text })),
        path1: input.path1,
        path2: input.path2,
      },
      finalUrls: input.finalUrls,
    },
    status: 'ENABLED',
  };

  const result = await mutate(customerId, 'adGroupAds', [{ create: ad }]);
  return JSON.stringify(result, null, 2);
}
