/**
 * Data Source and Moderator Format Enums
 *
 * Enums for vertical preset data sources and moderator output formats.
 */

import { z } from '@hono/zod-openapi';

// ============================================================================
// DATA SOURCE ID (5-part enum pattern)
// ============================================================================

// 1. ARRAY CONSTANT
export const DATA_SOURCE_IDS = ['sec-edgar', 'fred', 'finnhub', 'clinical-trials'] as const;

// 2. DEFAULT VALUE
export const DEFAULT_DATA_SOURCE_ID: DataSourceId = 'sec-edgar';

// 3. ZOD SCHEMA
export const DataSourceIdSchema = z.enum(DATA_SOURCE_IDS).openapi({
  description: 'Identifier for a domain data source',
  example: 'sec-edgar',
});

// 4. TYPESCRIPT TYPE
export type DataSourceId = z.infer<typeof DataSourceIdSchema>;

// 5. CONSTANT OBJECT
export const DataSourceIds = {
  CLINICAL_TRIALS: 'clinical-trials' as const,
  FINNHUB: 'finnhub' as const,
  FRED: 'fred' as const,
  SEC_EDGAR: 'sec-edgar' as const,
} as const;

// ============================================================================
// DATA SOURCE LABELS (shared between backend + frontend)
// ============================================================================

export const DATA_SOURCE_LABELS: Record<DataSourceId, string> = {
  'clinical-trials': 'ClinicalTrials.gov',
  'finnhub': 'Finnhub',
  'fred': 'FRED',
  'sec-edgar': 'SEC EDGAR',
};

// ============================================================================
// MODERATOR FORMAT ID (5-part enum pattern)
// ============================================================================

// 1. ARRAY CONSTANT
export const MODERATOR_FORMAT_IDS = ['deal-brief', 'investment-memo', 'clinical-summary', 'research-synthesis'] as const;

// 2. DEFAULT VALUE
export const DEFAULT_MODERATOR_FORMAT_ID: ModeratorFormatId = 'research-synthesis';

// 3. ZOD SCHEMA
export const ModeratorFormatIdSchema = z.enum(MODERATOR_FORMAT_IDS).openapi({
  description: 'Output format template for moderator synthesis',
  example: 'deal-brief',
});

// 4. TYPESCRIPT TYPE
export type ModeratorFormatId = z.infer<typeof ModeratorFormatIdSchema>;

// 5. CONSTANT OBJECT
export const ModeratorFormatIds = {
  CLINICAL_SUMMARY: 'clinical-summary' as const,
  DEAL_BRIEF: 'deal-brief' as const,
  INVESTMENT_MEMO: 'investment-memo' as const,
  RESEARCH_SYNTHESIS: 'research-synthesis' as const,
} as const;

// ============================================================================
// DATA SOURCE ENTRY (typed config for thread metadata)
// ============================================================================

export const DataSourceEntrySchema = z.object({
  config: z.record(z.string(), z.string()).optional(),
  id: DataSourceIdSchema,
}).openapi({
  description: 'A data source with optional configuration',
});

export type DataSourceEntry = z.infer<typeof DataSourceEntrySchema>;

// ============================================================================
// THREAD VERTICAL METADATA (typed thread.metadata for vertical presets)
// ============================================================================

export const ThreadVerticalMetadataSchema = z.object({
  dataSources: z.array(DataSourceEntrySchema).optional(),
  moderatorFormat: ModeratorFormatIdSchema.optional(),
}).openapi({
  description: 'Thread metadata for vertical preset configuration',
});

export type ThreadVerticalMetadata = z.infer<typeof ThreadVerticalMetadataSchema>;
