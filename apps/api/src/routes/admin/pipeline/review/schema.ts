import { z } from '@hono/zod-openapi';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const PipelineReviewParamsSchema = z.object({
  runId: z.string().min(1).openapi({
    description: 'Pipeline run ID to submit review for',
    example: '01HZ123ABC',
    param: { in: 'path', name: 'runId' },
  }),
});

export type PipelineReviewParams = z.infer<typeof PipelineReviewParamsSchema>;

export const ReviewedTopicSchema = z.object({
  platform: z.string().openapi({
    description: 'Platform where the topic was discovered',
    example: 'twitter',
  }),
  prompt: z.string().min(10).max(1000).openapi({
    description: 'Prompt for the debatekit discussion',
    example: 'Discuss the implications of AI agents in production systems',
  }),
  reasoning: z.string().openapi({
    description: 'Why this topic is relevant',
    example: 'High engagement topic with growing developer interest',
  }),
  relevanceScore: z.number().min(0).max(100).openapi({
    description: 'Relevance score (0-100)',
    example: 85,
  }),
  suggestedRounds: z.number().int().min(1).max(10).openapi({
    description: 'Number of discussion rounds',
    example: 3,
  }),
  topic: z.string().min(2).max(200).openapi({
    description: 'Topic title',
    example: 'AI Agents in Production',
  }),
});

export type ReviewedTopic = z.infer<typeof ReviewedTopicSchema>;

export const PipelineReviewBodySchema = z.object({
  topics: z.array(ReviewedTopicSchema).min(1).max(20).openapi({
    description: 'Reviewed and optionally customized topics for job creation',
  }),
}).openapi('PipelineReviewRequest');

export type PipelineReviewBody = z.infer<typeof PipelineReviewBodySchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const PipelineReviewResponseSchema = z.object({
  createdJobIds: z.array(z.string()).openapi({
    description: 'IDs of automated jobs created from reviewed topics',
  }),
}).openapi('PipelineReviewResponse');

export type PipelineReviewResponse = z.infer<typeof PipelineReviewResponseSchema>;
