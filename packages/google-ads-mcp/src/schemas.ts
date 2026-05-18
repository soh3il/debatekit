import { z } from 'zod';

export const SearchGaqlSchema = z.object({
  query: z.string().describe('GAQL query to execute'),
  customerId: z.string().optional().describe('Customer ID override (defaults to env)'),
});

export const CreateCampaignSchema = z.object({
  name: z.string().describe('Campaign name'),
  advertisingChannelType: z
    .enum(['SEARCH', 'DISPLAY', 'SHOPPING', 'VIDEO', 'PERFORMANCE_MAX'])
    .describe('Campaign type'),
  budgetResourceName: z.string().describe('Budget resource name (customers/{id}/campaignBudgets/{id})'),
  status: z.enum(['ENABLED', 'PAUSED']).default('PAUSED').describe('Campaign status'),
  customerId: z.string().optional().describe('Customer ID override'),
});

export const UpdateCampaignStatusSchema = z.object({
  campaignResourceName: z.string().describe('Campaign resource name (customers/{id}/campaigns/{id})'),
  status: z.enum(['ENABLED', 'PAUSED', 'REMOVED']).describe('New campaign status'),
  customerId: z.string().optional().describe('Customer ID override'),
});

export const CreateBudgetSchema = z.object({
  name: z.string().describe('Budget name'),
  amountMicros: z.string().describe('Budget amount in micros (e.g. "10000000" = $10)'),
  deliveryMethod: z.enum(['STANDARD', 'ACCELERATED']).default('STANDARD').describe('Budget delivery method'),
  customerId: z.string().optional().describe('Customer ID override'),
});

export const CreateAdGroupSchema = z.object({
  name: z.string().describe('Ad group name'),
  campaignResourceName: z.string().describe('Campaign resource name'),
  type: z.enum(['SEARCH_STANDARD', 'DISPLAY_STANDARD', 'SHOPPING_PRODUCT_ADS']).default('SEARCH_STANDARD'),
  cpcBidMicros: z.string().optional().describe('CPC bid in micros (e.g. "1000000" = $1)'),
  customerId: z.string().optional().describe('Customer ID override'),
});

export const CreateKeywordSchema = z.object({
  adGroupResourceName: z.string().describe('Ad group resource name'),
  text: z.string().describe('Keyword text'),
  matchType: z.enum(['EXACT', 'PHRASE', 'BROAD']).describe('Keyword match type'),
  cpcBidMicros: z.string().optional().describe('CPC bid in micros'),
  customerId: z.string().optional().describe('Customer ID override'),
});

export const RemoveKeywordSchema = z.object({
  keywordResourceName: z.string().describe('Keyword criterion resource name'),
  customerId: z.string().optional().describe('Customer ID override'),
});

export const CreateResponsiveSearchAdSchema = z.object({
  adGroupResourceName: z.string().describe('Ad group resource name'),
  headlines: z.array(z.string()).min(3).max(15).describe('3-15 headline texts (max 30 chars each)'),
  descriptions: z.array(z.string()).min(2).max(4).describe('2-4 description texts (max 90 chars each)'),
  finalUrls: z.array(z.string()).min(1).describe('Landing page URLs'),
  path1: z.string().optional().describe('Display URL path 1 (max 15 chars)'),
  path2: z.string().optional().describe('Display URL path 2 (max 15 chars)'),
  customerId: z.string().optional().describe('Customer ID override'),
});

export const GetKeywordIdeasSchema = z.object({
  keywords: z.array(z.string()).optional().describe('Seed keywords'),
  url: z.string().optional().describe('URL to generate keyword ideas from'),
  language: z.string().default('1000').describe('Language criterion ID (1000 = English)'),
  geoTargets: z.array(z.string()).default(['2840']).describe('Geo target criterion IDs (2840 = US)'),
  customerId: z.string().optional().describe('Customer ID override'),
});

export const CampaignReportSchema = z.object({
  dateRange: z
    .enum(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'LAST_MONTH'])
    .default('LAST_30_DAYS')
    .describe('Date range for the report'),
  campaignId: z.string().optional().describe('Filter to specific campaign ID'),
  customerId: z.string().optional().describe('Customer ID override'),
});

export const SearchTermsReportSchema = z.object({
  dateRange: z
    .enum(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'LAST_MONTH'])
    .default('LAST_30_DAYS')
    .describe('Date range for the report'),
  campaignId: z.string().optional().describe('Filter to specific campaign ID'),
  adGroupId: z.string().optional().describe('Filter to specific ad group ID'),
  customerId: z.string().optional().describe('Customer ID override'),
});

export const ListCustomersSchema = z.object({});

// ---------------------------------------------------------------------------
// Google Ads API response schemas
// ---------------------------------------------------------------------------

/** OAuth2 token refresh response */
export const TokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

/** OAuth2 authorization code exchange response (includes optional refresh_token) */
export const AuthCodeTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
});
export type AuthCodeTokenResponse = z.infer<typeof AuthCodeTokenResponseSchema>;

/** Token cache entry */
export const TokenCacheSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.number(),
});
export type TokenCache = z.infer<typeof TokenCacheSchema>;

/**
 * searchStream returns an array of batches, each with an optional results array.
 * Results are dynamic GAQL row objects -- we capture the structure we access
 * and let the row contents remain flexible via z.record.
 */
export const SearchStreamBatchSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())).optional(),
});
export const SearchStreamResponseSchema = z.array(SearchStreamBatchSchema);
export type SearchStreamResponse = z.infer<typeof SearchStreamResponseSchema>;

/**
 * Mutate response from Google Ads API.
 * Contains mutateOperationResponses or results depending on the entity type.
 * We capture the top-level shape; individual result entries vary per entity.
 */
export const MutateResponseSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())).optional(),
  mutateOperationResponses: z.array(z.record(z.string(), z.unknown())).optional(),
  partialFailureError: z.object({
    code: z.number(),
    message: z.string(),
  }).optional(),
});
export type MutateResponse = z.infer<typeof MutateResponseSchema>;

/** listAccessibleCustomers response */
export const AccessibleCustomersResponseSchema = z.object({
  resourceNames: z.array(z.string()),
});
export type AccessibleCustomersResponse = z.infer<typeof AccessibleCustomersResponseSchema>;

/** generateKeywordIdeas response */
export const KeywordIdeasResponseSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())).optional(),
  totalSize: z.string().optional(),
  nextPageToken: z.string().optional(),
});
export type KeywordIdeasResponse = z.infer<typeof KeywordIdeasResponseSchema>;

// ---------------------------------------------------------------------------
// Google Ads API request body schemas (for typed client function params)
// ---------------------------------------------------------------------------

/** Headers returned by getHeaders */
export const GoogleAdsHeadersSchema = z.object({
  'Authorization': z.string(),
  'Content-Type': z.string(),
  'developer-token': z.string(),
  'login-customer-id': z.string().optional(),
});
export type GoogleAdsHeaders = z.infer<typeof GoogleAdsHeadersSchema>;

/** Mutate operation -- create, update, or remove */
export const MutateOperationSchema = z.union([
  z.object({ create: z.record(z.string(), z.unknown()) }),
  z.object({
    update: z.record(z.string(), z.unknown()),
    updateMask: z.string(),
  }),
  z.object({ remove: z.string() }),
]);
export type MutateOperation = z.infer<typeof MutateOperationSchema>;

/** Body for generateKeywordIdeas */
export const KeywordIdeasBodySchema = z.object({
  language: z.string(),
  geoTargetConstants: z.array(z.string()),
  keywordPlanNetwork: z.string(),
  keywordSeed: z.object({ keywords: z.array(z.string()) }).optional(),
  urlSeed: z.object({ url: z.string() }).optional(),
});
export type KeywordIdeasBody = z.infer<typeof KeywordIdeasBodySchema>;

// ---------------------------------------------------------------------------
// Tool-level typed request objects (for mutate operations)
// ---------------------------------------------------------------------------

/** Ad group create payload */
export const AdGroupCreatePayloadSchema = z.object({
  name: z.string(),
  campaign: z.string(),
  type: z.string(),
  status: z.string(),
  cpcBidMicros: z.string().optional(),
});
export type AdGroupCreatePayload = z.infer<typeof AdGroupCreatePayloadSchema>;

/** Responsive search ad create payload */
export const AdGroupAdCreatePayloadSchema = z.object({
  adGroup: z.string(),
  ad: z.object({
    responsiveSearchAd: z.object({
      headlines: z.array(z.object({ text: z.string() })),
      descriptions: z.array(z.object({ text: z.string() })),
      path1: z.string().optional(),
      path2: z.string().optional(),
    }),
    finalUrls: z.array(z.string()),
  }),
  status: z.string(),
});
export type AdGroupAdCreatePayload = z.infer<typeof AdGroupAdCreatePayloadSchema>;

/** Keyword criterion create payload */
export const KeywordCriterionCreatePayloadSchema = z.object({
  adGroup: z.string(),
  keyword: z.object({
    text: z.string(),
    matchType: z.string(),
  }),
  status: z.string(),
  cpcBidMicros: z.string().optional(),
});
export type KeywordCriterionCreatePayload = z.infer<typeof KeywordCriterionCreatePayloadSchema>;
