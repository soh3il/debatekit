import { z } from '@hono/zod-openapi';

// ============================================================================
// ADMIN SETTING KEYS (5-part enum pattern)
// ============================================================================

export const ADMIN_SETTING_KEYS = [
  'autoTweetEnabled',
  'continuous',
  'dailyJobLimit',
  'dailyTweetLimit',
  'defaultRoundCount',
  'keywordGenerationPrompt',
  'modelSelectionPrompt',
  'participantBehaviorPrompt',
  'pipelineEnabled',
  'roundPromptGeneration',
  'systemPrompt',
  'topicGuidance',
  'trendExtractionPrompt',
  'tweetSkillsPrompt',
  'tweetSystemPrompt',
  'viralScoringPrompt',
  'viralScoreThreshold',
] as const;

export const AdminSettingKeySchema = z.enum(ADMIN_SETTING_KEYS);

export type AdminSettingKey = z.infer<typeof AdminSettingKeySchema>;

export const AdminSettingKeys = {
  AUTO_TWEET_ENABLED: 'autoTweetEnabled',
  CONTINUOUS: 'continuous',
  DAILY_JOB_LIMIT: 'dailyJobLimit',
  DAILY_TWEET_LIMIT: 'dailyTweetLimit',
  DEFAULT_ROUND_COUNT: 'defaultRoundCount',
  KEYWORD_GENERATION_PROMPT: 'keywordGenerationPrompt',
  MODEL_SELECTION_PROMPT: 'modelSelectionPrompt',
  PARTICIPANT_BEHAVIOR_PROMPT: 'participantBehaviorPrompt',
  PIPELINE_ENABLED: 'pipelineEnabled',
  ROUND_PROMPT_GENERATION: 'roundPromptGeneration',
  SYSTEM_PROMPT: 'systemPrompt',
  TOPIC_GUIDANCE: 'topicGuidance',
  TREND_EXTRACTION_PROMPT: 'trendExtractionPrompt',
  TWEET_SKILLS_PROMPT: 'tweetSkillsPrompt',
  TWEET_SYSTEM_PROMPT: 'tweetSystemPrompt',
  VIRAL_SCORING_PROMPT: 'viralScoringPrompt',
  VIRAL_SCORE_THRESHOLD: 'viralScoreThreshold',
} as const;

// ============================================================================
// DEFAULTS
// ============================================================================

/**
 * Default values for admin settings.
 * Used when a setting has not been persisted to the DB yet.
 */
export const ADMIN_SETTING_DEFAULTS: Record<AdminSettingKey, string> = {
  autoTweetEnabled: 'true',
  continuous: 'false',
  dailyJobLimit: '10',
  dailyTweetLimit: '5',
  defaultRoundCount: '3',
  keywordGenerationPrompt: '',
  modelSelectionPrompt: '',
  participantBehaviorPrompt: '',
  pipelineEnabled: 'true',
  roundPromptGeneration: '',
  systemPrompt: '',
  topicGuidance: '',
  trendExtractionPrompt: '',
  tweetSkillsPrompt: '',
  tweetSystemPrompt: '',
  viralScoringPrompt: '',
  viralScoreThreshold: '60',
};

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * PATCH body: partial set of admin settings to update.
 * Each field is optional; only provided fields are written.
 */
export const AdminSettingsPatchBodySchema = z.object({
  autoTweetEnabled: z.boolean().optional().openapi({
    description: 'Auto-generate tweets on job completion',
    example: true,
  }),
  continuous: z.boolean().optional().openapi({
    description: 'Automatically re-trigger pipeline on completion',
    example: false,
  }),
  dailyJobLimit: z.number().int().min(0).max(100).optional().openapi({
    description: 'Max automated jobs per day',
    example: 10,
  }),
  dailyTweetLimit: z.number().int().min(0).max(100).optional().openapi({
    description: 'Max tweets posted per day',
    example: 5,
  }),
  defaultRoundCount: z.number().int().min(1).max(10).optional().openapi({
    description: 'Default number of debate rounds per pipeline run',
    example: 3,
  }),
  keywordGenerationPrompt: z.string().max(10000).optional().openapi({
    description: 'System prompt for keyword generation in auto-discovery',
    example: '',
  }),
  modelSelectionPrompt: z.string().max(10000).optional().openapi({
    description: 'System prompt for AI model selection',
    example: '',
  }),
  participantBehaviorPrompt: z.string().max(10000).optional().openapi({
    description: 'Global behavior rules for debatekit participants',
    example: '',
  }),
  pipelineEnabled: z.boolean().optional().openapi({
    description: 'On/off switch for the entire content pipeline',
    example: true,
  }),
  roundPromptGeneration: z.string().max(10000).optional().openapi({
    description: 'System prompt for generating follow-up round prompts',
    example: '',
  }),
  systemPrompt: z.string().max(5000).optional().openapi({
    description: 'System prompt for the pipeline AI',
    example: '',
  }),
  topicGuidance: z.string().max(2000).optional().openapi({
    description: 'Guidance text for topic selection',
    example: '',
  }),
  trendExtractionPrompt: z.string().max(10000).optional().openapi({
    description: 'Prompt template for extracting trends from search results',
    example: '',
  }),
  tweetSkillsPrompt: z.string().max(15000).optional().openapi({
    description: 'Full tweet crafting skills prompt (copywriting, psychology, humanizer)',
    example: '',
  }),
  tweetSystemPrompt: z.string().max(5000).optional().openapi({
    description: 'Custom system prompt prepended to tweet generation AI',
    example: '',
  }),
  viralScoringPrompt: z.string().max(10000).optional().openapi({
    description: 'System prompt for viral score evaluation',
    example: '',
  }),
  viralScoreThreshold: z.number().int().min(0).max(100).optional().openapi({
    description: 'Min viral score for topic selection',
    example: 60,
  }),
}).openapi('AdminSettingsPatchBody');

export type AdminSettingsPatchBody = z.infer<typeof AdminSettingsPatchBodySchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Full admin settings payload returned by GET and PATCH.
 */
export const AdminSettingsPayloadSchema = z.object({
  autoTweetEnabled: z.boolean().openapi({
    description: 'Auto-generate tweets on job completion',
    example: true,
  }),
  continuous: z.boolean().openapi({
    description: 'Automatically re-trigger pipeline on completion',
    example: false,
  }),
  dailyJobLimit: z.number().openapi({
    description: 'Max automated jobs per day',
    example: 10,
  }),
  dailyTweetLimit: z.number().openapi({
    description: 'Max tweets posted per day',
    example: 5,
  }),
  defaultRoundCount: z.number().openapi({
    description: 'Default number of debate rounds per pipeline run',
    example: 3,
  }),
  keywordGenerationPrompt: z.string().openapi({
    description: 'System prompt for keyword generation in auto-discovery',
    example: '',
  }),
  modelSelectionPrompt: z.string().openapi({
    description: 'System prompt for AI model selection',
    example: '',
  }),
  participantBehaviorPrompt: z.string().openapi({
    description: 'Global behavior rules for debatekit participants',
    example: '',
  }),
  pipelineEnabled: z.boolean().openapi({
    description: 'On/off switch for the entire content pipeline',
    example: true,
  }),
  roundPromptGeneration: z.string().openapi({
    description: 'System prompt for generating follow-up round prompts',
    example: '',
  }),
  systemPrompt: z.string().openapi({
    description: 'System prompt for the pipeline AI',
    example: '',
  }),
  topicGuidance: z.string().openapi({
    description: 'Guidance text for topic selection',
    example: '',
  }),
  trendExtractionPrompt: z.string().openapi({
    description: 'Prompt template for extracting trends from search results',
    example: '',
  }),
  tweetSkillsPrompt: z.string().openapi({
    description: 'Full tweet crafting skills prompt (copywriting, psychology, humanizer)',
    example: '',
  }),
  tweetSystemPrompt: z.string().openapi({
    description: 'Custom system prompt prepended to tweet generation AI',
    example: '',
  }),
  viralScoringPrompt: z.string().openapi({
    description: 'System prompt for viral score evaluation',
    example: '',
  }),
  viralScoreThreshold: z.number().openapi({
    description: 'Min viral score for topic selection',
    example: 60,
  }),
}).openapi('AdminSettingsPayload');

export type AdminSettingsPayload = z.infer<typeof AdminSettingsPayloadSchema>;
