import type { z } from 'zod';

import { generateKeywordIdeas, getCustomerId, mutate } from '../google-ads-client.js';
import type {
  CreateKeywordSchema,
  GetKeywordIdeasSchema,
  KeywordCriterionCreatePayload,
  KeywordIdeasBody,
  RemoveKeywordSchema,
} from '../schemas.js';

export async function handleCreateKeyword(
  input: z.infer<typeof CreateKeywordSchema>,
): Promise<string> {
  const customerId = getCustomerId(input.customerId);

  const criterion: KeywordCriterionCreatePayload = {
    adGroup: input.adGroupResourceName,
    keyword: {
      text: input.text,
      matchType: input.matchType,
    },
    status: 'ENABLED',
    ...(input.cpcBidMicros ? { cpcBidMicros: input.cpcBidMicros } : {}),
  };

  const result = await mutate(customerId, 'adGroupCriteria', [{ create: criterion }]);
  return JSON.stringify(result, null, 2);
}

export async function handleRemoveKeyword(
  input: z.infer<typeof RemoveKeywordSchema>,
): Promise<string> {
  const customerId = getCustomerId(input.customerId);
  const result = await mutate(customerId, 'adGroupCriteria', [
    { remove: input.keywordResourceName },
  ]);
  return JSON.stringify(result, null, 2);
}

export async function handleGetKeywordIdeas(
  input: z.infer<typeof GetKeywordIdeasSchema>,
): Promise<string> {
  const customerId = getCustomerId(input.customerId);

  const body: KeywordIdeasBody = {
    language: `languageConstants/${input.language}`,
    geoTargetConstants: input.geoTargets.map(id => `geoTargetConstants/${id}`),
    keywordPlanNetwork: 'GOOGLE_SEARCH',
    ...(input.keywords?.length ? { keywordSeed: { keywords: input.keywords } } : {}),
    ...(input.url ? { urlSeed: { url: input.url } } : {}),
  };

  const result = await generateKeywordIdeas(customerId, body);
  return JSON.stringify(result, null, 2);
}
