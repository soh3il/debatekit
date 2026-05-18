import type { z } from 'zod';

import { getCustomerId, searchGaql } from '../google-ads-client.js';
import type { SearchGaqlSchema } from '../schemas.js';

export async function handleSearchGaql(
  input: z.infer<typeof SearchGaqlSchema>,
): Promise<string> {
  const customerId = getCustomerId(input.customerId);
  const results = await searchGaql(customerId, input.query);
  return JSON.stringify(results, null, 2);
}
