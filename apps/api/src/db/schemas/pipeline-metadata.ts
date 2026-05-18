/**
 * Pipeline Metadata Schemas - Single Source of Truth
 *
 * Zod schemas for content pipeline run metadata stored in database.
 * Follows the same pattern as job-metadata.ts for type safety.
 */

import * as z from 'zod';

// ============================================================================
// DISCOVERED TOPIC SCHEMA
// ============================================================================

/**
 * A topic discovered during the pipeline's discovery phase
 */
export const DbPipelineDiscoveredTopicSchema = z.object({
  keyword: z.string(),
  platform: z.string(),
  prompt: z.string(),
  reasoning: z.string(),
  relevanceScore: z.number(),
  suggestedRounds: z.number(),
  topic: z.string(),
}).strict();

export type DbPipelineDiscoveredTopic = z.infer<typeof DbPipelineDiscoveredTopicSchema>;

// ============================================================================
// SELECTED TOPIC SCHEMA
// ============================================================================

/**
 * A topic selected for job creation, extends discovered topic with viral score
 */
export const DbPipelineSelectedTopicSchema = DbPipelineDiscoveredTopicSchema.extend({
  jobId: z.string().optional(),
  viralBreakdown: z.object({
    curiosityGap: z.number(),
    emotionalTrigger: z.number(),
    engagementPotential: z.number(),
    hookStrength: z.number(),
    relevanceTimeliness: z.number(),
  }).optional(),
  viralScore: z.number().min(0).max(100),
  viralSuggestions: z.array(z.string()).optional(),
}).strict();

export type DbPipelineSelectedTopic = z.infer<typeof DbPipelineSelectedTopicSchema>;

// ============================================================================
// CONTENT PIPELINE METADATA SCHEMA
// ============================================================================

/**
 * Content Pipeline Run Metadata
 * Stores discovery details, keywords used, platforms searched, and timing info
 */
export const DbContentPipelineMetadataSchema = z.object({
  discoveryDurationMs: z.number().optional(),
  jobCreationDurationMs: z.number().optional(),
  keywordsUsed: z.array(z.string()).optional(),
  /** Performance analysis: avg engagement rate from past tweets used to inform this run */
  performanceAvgEngagement: z.number().optional(),
  /** Performance analysis: top styles identified from past engagement data */
  performanceTopStyles: z.array(z.string()).optional(),
  /** Performance analysis: top topic themes identified from past engagement data */
  performanceTopThemes: z.array(z.string()).optional(),
  /** How many past tweets were analyzed for performance insights */
  performanceTweetsAnalyzed: z.number().optional(),
  platformsSearched: z.array(z.string()).optional(),
  totalResultsAnalyzed: z.number().optional(),
}).strict();

export type DbContentPipelineMetadata = z.infer<typeof DbContentPipelineMetadataSchema>;

// ============================================================================
// VIRAL SCORE MAP SCHEMA
// ============================================================================

/**
 * Map of topic names to viral scores (0-100).
 * Used for dynamic topic-keyed scoring in pipeline runs.
 */
export const DbViralScoreMapSchema = z.record(z.string(), z.number().min(0).max(100));

export type DbViralScoreMap = z.infer<typeof DbViralScoreMapSchema>;
