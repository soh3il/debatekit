import type { ModelCapabilityTag, ModelId } from '@debatekit/shared/enums';
import {
  ModelCapabilityTags,
  ModelCapabilityTagSchema,
  ModelCategorySchema,
  ModelIds,
  ModelIdSchema,
  ModelProviderSchema,
  PROVIDER_STREAMING_DEFAULTS,
  StreamingBehaviors,
  StreamingBehaviorSchema,
} from '@debatekit/shared/enums';
import { z } from '@hono/zod-openapi';

// ============================================================================
// HARDCODED MODEL SCHEMA
// ============================================================================

export const HardcodedModelSchema = z.object({
  architecture: z
    .object({
      instruct_type: z.string().nullable().optional(),
      modality: z.string().nullable().optional(),
      tokenizer: z.string().nullable().optional(),
    })
    .strict()
    .nullable()
    .optional(),
  capabilities: z.object({
    file: z.boolean(), // ✅ Whether model supports file/document inputs (PDFs, DOC, etc.)
    reasoning: z.boolean(),
    streaming: z.boolean(),
    tools: z.boolean(),
    vision: z.boolean(),
  }).strict(),
  category: ModelCategorySchema,
  context_length: z.number(),
  created: z.number().optional(),
  description: z.string().optional(),
  id: ModelIdSchema,
  is_free: z.boolean(),
  is_reasoning_model: z.boolean(),
  maxFileSizeMB: z.number(), // ✅ Max total file size this model can handle (MB) - derived from context_length
  name: z.string(),
  per_request_limits: z
    .object({
      completion_tokens: z.number().nullable().optional(),
      prompt_tokens: z.number().nullable().optional(),
    })
    .strict()
    .nullable()
    .optional(),
  pricing: z.object({
    completion: z.string(),
    prompt: z.string(),
  }).strict(),
  pricing_display: z.object({
    input: z.string(),
    output: z.string(),
  }).strict(),
  provider: ModelProviderSchema,
  streaming_behavior: StreamingBehaviorSchema.optional(),
  supports_file: z.boolean(), // ✅ Whether model supports file content types (PDFs) - derived from modality containing '+file'
  supports_reasoning_stream: z.boolean(),
  supports_temperature: z.boolean(),
  supports_vision: z.boolean(),
  tags: z.array(ModelCapabilityTagSchema), // User-facing capability filter tags
  top_provider: z
    .object({
      context_length: z.number().nullable().optional(),
      is_moderated: z.boolean().nullable().optional(),
      max_completion_tokens: z.number().nullable().optional(),
    })
    .strict()
    .nullable()
    .optional(),
}).strict();

export type HardcodedModel = z.infer<typeof HardcodedModelSchema>;

/**
 * ✅ DERIVE MAX FILE SIZE: Calculate max file upload capacity from context length
 * Formula: (context_length × 0.4) / 250,000
 * - 0.4 = 40% of context reserved for files
 * - 250,000 = ~tokens per MB of PDF content
 * - Minimum 1 MB for any model
 */
function deriveMaxFileSizeMB(contextLength: number) {
  const calculated = Math.floor((contextLength * 0.4) / 250000);
  return Math.max(1, calculated); // Minimum 1 MB
}

/**
 * Derive capability tags from model properties
 * - fast: Input cost < $0.50/M (affordable/quick models)
 * - vision: Supports image/visual input
 * - reasoning: Enhanced reasoning/thinking capability
 * - pdf: Supports PDF/document processing
 */
function deriveModelTags(model: BaseModelData): ModelCapabilityTag[] {
  const tags: ModelCapabilityTag[] = [];

  // Fast: input price < $0.50/M
  const inputPrice = Number.parseFloat(model.pricing.prompt) * 1_000_000;
  if (inputPrice < 0.5) {
    tags.push(ModelCapabilityTags.FAST);
  }

  if (model.supports_vision) {
    tags.push(ModelCapabilityTags.VISION);
  }

  if (model.is_reasoning_model) {
    tags.push(ModelCapabilityTags.REASONING);
  }

  if (model.supports_file) {
    tags.push(ModelCapabilityTags.PDF);
  }

  return tags;
}

// Base model data without computed fields (tags + maxFileSizeMB are derived automatically)
type BaseModelData = Omit<HardcodedModel, 'tags' | 'maxFileSizeMB'>;

const BASE_MODELS: readonly BaseModelData[] = [
  {
    architecture: { instruct_type: 'mistral', modality: 'text+image->text', tokenizer: 'Mistral' },
    capabilities: { file: false, reasoning: false, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 131072,
    created: 1748390400,
    description: 'Ultra-light responder. Perfect for quick chats and simple tasks on a budget.',
    id: 'mistralai/ministral-3b-2512',
    is_free: false,
    is_reasoning_model: false,
    name: 'Ministral 3B',
    per_request_limits: null,
    pricing: { completion: '0.00000010', prompt: '0.00000010' },
    pricing_display: { input: '$0.10/1M', output: '$0.10/1M' },
    provider: 'mistralai',
    supports_file: false,
    supports_reasoning_stream: false,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 131072, is_moderated: false, max_completion_tokens: 16384 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text->text', tokenizer: 'o200k_base' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: false },
    category: 'general',
    context_length: 131072,
    created: 1733097600,
    description: 'Budget-friendly thinker. Good for everyday questions and quick reasoning tasks.',
    id: 'openai/gpt-oss-120b',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-OSS 120B',
    per_request_limits: null,
    pricing: { completion: '0.00000019', prompt: '0.000000039' },
    pricing_display: { input: '$0.039/1M', output: '$0.19/1M' },
    provider: 'openai',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: false,
    top_provider: { context_length: 131072, is_moderated: false, max_completion_tokens: 16384 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    // ✅ GPT-5 NANO HAS MANDATORY REASONING: Model uses encrypted reasoning tokens internally
    // Reference: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
    // Without reasoning config, model exhausts tokens on hidden reasoning before generating text
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 400000,
    created: 1723075200,
    description: 'Lightning-fast responder. Perfect for quick answers and simple tasks.',
    id: 'openai/gpt-5-nano',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-5 Nano',
    per_request_limits: null,
    pricing: { completion: '0.00000040', prompt: '0.00000005' },
    pricing_display: { input: '$0.05/1M', output: '$0.40/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 400000, is_moderated: true, max_completion_tokens: 32768 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: false, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1047576,
    created: 1713052800,
    description: 'Efficient helper. Ideal for sorting ideas and finishing your sentences.',
    id: 'openai/gpt-4.1-nano',
    is_free: false,
    is_reasoning_model: false,
    name: 'GPT-4.1 Nano',
    per_request_limits: null,
    pricing: { completion: '0.00000040', prompt: '0.00000010' },
    pricing_display: { input: '$0.10/1M', output: '$0.40/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: false,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1047576, is_moderated: true, max_completion_tokens: 32768 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: false, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 128000,
    created: 1715385600,
    description: 'Reliable all-rounder. Balanced performance for most everyday tasks.',
    id: 'openai/gpt-4o-mini',
    is_free: false,
    is_reasoning_model: false,
    name: 'GPT-4o Mini',
    per_request_limits: null,
    pricing: { completion: '0.00000060', prompt: '0.00000015' },
    pricing_display: { input: '$0.15/1M', output: '$0.60/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: false,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 128000, is_moderated: true, max_completion_tokens: 16384 },
  },
  {
    architecture: { instruct_type: 'grok', modality: 'text+image->text', tokenizer: 'Grok' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 2000000,
    created: 1735689600,
    description: 'Real-time intelligence. Access to X/Twitter data, trending topics, and breaking news.',
    id: 'x-ai/grok-4-fast',
    is_free: false,
    is_reasoning_model: true,
    name: 'Grok 4 Fast',
    per_request_limits: null,
    pricing: { completion: '0.00000050', prompt: '0.00000020' },
    pricing_display: { input: '$0.20/1M', output: '$0.50/1M' },
    provider: 'x-ai',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 2000000, is_moderated: false, max_completion_tokens: 30000 },
  },
  {
    architecture: { instruct_type: 'grok', modality: 'text+image->text', tokenizer: 'Grok' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 2000000,
    created: 1733097600,
    description: 'Live data specialist. Access to X/Twitter posts, social sentiment, and current events.',
    id: 'x-ai/grok-4.1-fast',
    is_free: false,
    is_reasoning_model: true,
    name: 'Grok 4.1 Fast',
    per_request_limits: null,
    pricing: { completion: '0.00000050', prompt: '0.00000020' },
    pricing_display: { input: '$0.20/1M', output: '$0.50/1M' },
    provider: 'x-ai',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 2000000, is_moderated: false, max_completion_tokens: 30000 },
  },
  {
    architecture: { instruct_type: 'grok', modality: 'text->text', tokenizer: 'Grok' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: false },
    category: 'general',
    context_length: 256000,
    created: 1740441600,
    description: 'Code specialist. Shows its thinking while solving programming problems.',
    id: 'x-ai/grok-code-fast-1',
    is_free: false,
    is_reasoning_model: true,
    name: 'Grok Code Fast',
    per_request_limits: null,
    pricing: { completion: '0.00000150', prompt: '0.00000020' },
    pricing_display: { input: '$0.20/1M', output: '$1.50/1M' },
    provider: 'x-ai',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: false,
    top_provider: { context_length: 256000, is_moderated: false, max_completion_tokens: 16384 },
  },
  {
    architecture: { instruct_type: 'deepseek', modality: 'text->text', tokenizer: 'DeepSeek' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: false },
    category: 'general',
    context_length: 163840,
    created: 1733097600,
    description: 'Context master. Excels at analyzing long documents and conversations.',
    id: 'deepseek/deepseek-v3.2',
    is_free: false,
    is_reasoning_model: true,
    name: 'DeepSeek V3.2',
    per_request_limits: null,
    pricing: { completion: '0.00000040', prompt: '0.00000025' },
    pricing_display: { input: '$0.25/1M', output: '$0.40/1M' },
    provider: 'deepseek',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: false,
    top_provider: { context_length: 163840, is_moderated: false, max_completion_tokens: 8192 },
  },
  {
    architecture: { instruct_type: 'gemini', modality: 'text+image+video+audio+file->text', tokenizer: 'Gemini' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1048576,
    created: 1740441600,
    description: 'Analytical mind. Strong at math, coding, and technical problems.',
    id: 'google/gemini-2.5-flash',
    is_free: false,
    is_reasoning_model: true,
    name: 'Gemini 2.5 Flash',
    per_request_limits: null,
    pricing: { completion: '0.00000250', prompt: '0.00000030' },
    pricing_display: { input: '$0.30/1M', output: '$2.50/1M' },
    provider: 'google',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1048576, is_moderated: false, max_completion_tokens: 65536 },
  },
  {
    architecture: { instruct_type: null, modality: 'text->text', tokenizer: 'DeepSeek' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: false },
    category: 'reasoning',
    context_length: 1048576,
    created: 1777000666,
    description: 'Ultra-cheap MoE thinker. Fast inference with a massive 1M-token context window.',
    id: 'deepseek/deepseek-v4-flash',
    is_free: false,
    is_reasoning_model: true,
    name: 'DeepSeek V4 Flash',
    per_request_limits: null,
    pricing: { completion: '0.00000018', prompt: '0.00000009' },
    pricing_display: { input: '$0.09/1M', output: '$0.18/1M' },
    provider: 'deepseek',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: false,
    top_provider: { context_length: 1000000, is_moderated: false, max_completion_tokens: 65536 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'GPT' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 400000,
    created: 1773748187,
    description: 'Featherweight GPT-5.4. Cheapest variant tuned for speed-critical, high-volume tasks.',
    id: 'openai/gpt-5.4-nano',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-5.4 Nano',
    per_request_limits: null,
    pricing: { completion: '0.00000125', prompt: '0.00000020' },
    pricing_display: { input: '$0.20/1M', output: '$1.25/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: false,
    supports_vision: true,
    top_provider: { context_length: 400000, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: 'gemini', modality: 'text+image+file+audio+video->text', tokenizer: 'Gemini' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1048576,
    created: 1778168828,
    description: 'GA Flash Lite. Low-latency multimodal model for lightweight agentic, high-volume work.',
    id: 'google/gemini-3.1-flash-lite',
    is_free: false,
    is_reasoning_model: true,
    name: 'Gemini 3.1 Flash Lite',
    per_request_limits: null,
    pricing: { completion: '0.00000150', prompt: '0.00000025' },
    pricing_display: { input: '$0.25/1M', output: '$1.50/1M' },
    provider: 'google',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1048576, is_moderated: false, max_completion_tokens: 65536 },
  },
  {
    architecture: { instruct_type: null, modality: 'text+image->text', tokenizer: 'Qwen' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1000000,
    created: 1780491783,
    description: 'Cost-effective Qwen. Solid all-rounder with vision and a 1M-token context window.',
    id: 'qwen/qwen3.7-plus',
    is_free: false,
    is_reasoning_model: true,
    name: 'Qwen3.7 Plus',
    per_request_limits: null,
    pricing: { completion: '0.00000128', prompt: '0.00000032' },
    pricing_display: { input: '$0.32/1M', output: '$1.28/1M' },
    provider: 'qwen',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1000000, is_moderated: false, max_completion_tokens: 65536 },
  },
  {
    architecture: { instruct_type: null, modality: 'text->text', tokenizer: 'DeepSeek' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: false },
    category: 'reasoning',
    context_length: 1048576,
    created: 1777000679,
    description: 'Frontier MoE reasoner. 1.6T-param model built for deep reasoning, coding, and analysis.',
    id: 'deepseek/deepseek-v4-pro',
    is_free: false,
    is_reasoning_model: true,
    name: 'DeepSeek V4 Pro',
    per_request_limits: null,
    pricing: { completion: '0.00000087', prompt: '0.000000435' },
    pricing_display: { input: '$0.435/1M', output: '$0.87/1M' },
    provider: 'deepseek',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: false,
    top_provider: { context_length: 1048576, is_moderated: false, max_completion_tokens: 384000 },
  },

  // ========================================================================
  // PRO TIER ONLY (>$0.20/M) - Premium models requiring paid subscription
  // ========================================================================
  {
    architecture: { instruct_type: 'gemini', modality: 'text+image+video+audio+file->text', tokenizer: 'Gemini' },
    capabilities: { file: true, reasoning: false, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1048576,
    created: 1771509627,
    description: 'Half the cost of Flash. Efficient multimodal model for budget-friendly tasks.',
    id: 'google/gemini-3.1-flash-lite-preview',
    is_free: false,
    is_reasoning_model: false,
    name: 'Gemini 3.1 Flash Lite Preview',
    per_request_limits: null,
    pricing: { completion: '0.00000150', prompt: '0.00000025' },
    pricing_display: { input: '$0.25/1M', output: '$1.50/1M' },
    provider: 'google',
    supports_file: true,
    supports_reasoning_stream: false,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1048576, is_moderated: false, max_completion_tokens: 65536 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 400000,
    created: 1723075200,
    description: 'Smart and snappy. Balanced intelligence with quick responses.',
    id: 'openai/gpt-5-mini',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-5 Mini',
    per_request_limits: null,
    pricing: { completion: '0.00000200', prompt: '0.00000025' },
    pricing_display: { input: '$0.25/1M', output: '$2/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 400000, is_moderated: true, max_completion_tokens: 32768 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: false, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1047576,
    created: 1713052800,
    description: 'Capable workhorse. Handles complex tasks without breaking the bank.',
    id: 'openai/gpt-4.1-mini',
    is_free: false,
    is_reasoning_model: false,
    name: 'GPT-4.1 Mini',
    per_request_limits: null,
    pricing: { completion: '0.00000160', prompt: '0.00000040' },
    pricing_display: { input: '$0.40/1M', output: '$1.60/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: false,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1047576, is_moderated: true, max_completion_tokens: 32768 },
  },
  {
    architecture: { instruct_type: 'deepseek', modality: 'text->text', tokenizer: 'DeepSeek' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: false },
    category: 'reasoning',
    context_length: 163840,
    created: 1748390400,
    description: 'High-compute reasoning variant. Maximum thinking power for complex problems.',
    id: 'deepseek/deepseek-v3.2-speciale',
    is_free: false,
    is_reasoning_model: true,
    name: 'DeepSeek V3.2 Speciale',
    per_request_limits: null,
    pricing: { completion: '0.00000120', prompt: '0.00000040' },
    pricing_display: { input: '$0.40/1M', output: '$1.20/1M' },
    provider: 'deepseek',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: false,
    top_provider: { context_length: 163840, is_moderated: false, max_completion_tokens: 8192 },
  },
  {
    architecture: { instruct_type: 'mistral', modality: 'text+image->text', tokenizer: 'Mistral' },
    capabilities: { file: false, reasoning: false, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 262144,
    created: 1733097600,
    description: 'European powerhouse. Great for multilingual and creative writing.',
    id: 'mistralai/mistral-large-2512',
    is_free: false,
    is_reasoning_model: false,
    name: 'Mistral Large 3 2512',
    per_request_limits: null,
    pricing: { completion: '0.00000150', prompt: '0.00000050' },
    pricing_display: { input: '$0.50/1M', output: '$1.50/1M' },
    provider: 'mistralai',
    supports_file: false,
    supports_reasoning_stream: false,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 262144, is_moderated: false, max_completion_tokens: 16384 },
  },
  {
    architecture: { instruct_type: 'gemini', modality: 'text+image+video+audio+file->text', tokenizer: 'Gemini' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1048576,
    created: 1734393600,
    description: 'Flexible thinker. Adjusts how deeply it thinks based on your needs.',
    id: 'google/gemini-3-flash-preview',
    is_free: false,
    is_reasoning_model: true,
    name: 'Gemini 3 Flash Preview',
    per_request_limits: null,
    pricing: { completion: '0.00000300', prompt: '0.00000050' },
    pricing_display: { input: '$0.50/1M', output: '$3/1M' },
    provider: 'google',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1048576, is_moderated: false, max_completion_tokens: 65536 },
  },
  {
    architecture: { instruct_type: 'claude', modality: 'text+image->text', tokenizer: 'Claude' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 200000,
    created: 1733097600,
    description: 'Quick but thoughtful. Fast responses with careful reasoning.',
    id: 'anthropic/claude-haiku-4.5',
    is_free: false,
    is_reasoning_model: true,
    name: 'Claude Haiku 4.5',
    per_request_limits: null,
    pricing: { completion: '0.00000500', prompt: '0.00000100' },
    pricing_display: { input: '$1/1M', output: '$5/1M' },
    provider: 'anthropic',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 200000, is_moderated: false, max_completion_tokens: 64000 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: false },
    category: 'reasoning',
    context_length: 200000,
    created: 1748390400,
    description: 'Science whiz. Excellent for math, physics, and technical questions.',
    id: 'openai/o3-mini',
    is_free: false,
    is_reasoning_model: true,
    name: 'OpenAI o3-mini',
    per_request_limits: null,
    pricing: { completion: '0.00000440', prompt: '0.00000110' },
    pricing_display: { input: '$1.10/1M', output: '$4.40/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: false,
    top_provider: { context_length: 200000, is_moderated: true, max_completion_tokens: 100000 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'reasoning',
    context_length: 200000,
    created: 1748390400,
    description: 'Visual problem solver. Reasons through images and diagrams.',
    id: 'openai/o4-mini',
    is_free: false,
    is_reasoning_model: true,
    name: 'OpenAI o4-mini',
    per_request_limits: null,
    pricing: { completion: '0.00000440', prompt: '0.00000110' },
    pricing_display: { input: '$1.10/1M', output: '$4.40/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 200000, is_moderated: true, max_completion_tokens: 100000 },
  },

  // ========================================================================
  // PRO TIER - Mid-range premium models (≤$5.00/M)
  // ========================================================================
  {
    architecture: { instruct_type: null, modality: 'text+image->text', tokenizer: 'Other' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 262144,
    created: 1781266361,
    description: 'Coding specialist. Built for reliable end-to-end programming over long contexts.',
    id: 'moonshotai/kimi-k2.7-code',
    is_free: false,
    is_reasoning_model: true,
    name: 'Kimi K2.7 Code',
    per_request_limits: null,
    pricing: { completion: '0.000003069', prompt: '0.000000612' },
    pricing_display: { input: '$0.612/1M', output: '$3.069/1M' },
    provider: 'moonshotai',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 262144, is_moderated: false, max_completion_tokens: 262144 },
  },
  {
    architecture: { instruct_type: null, modality: 'text+image->text', tokenizer: 'Other' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 262144,
    created: 1776699402,
    description: 'Multimodal coder. Strong at long-horizon coding and multi-agent orchestration.',
    id: 'moonshotai/kimi-k2.6',
    is_free: false,
    is_reasoning_model: true,
    name: 'Kimi K2.6',
    per_request_limits: null,
    pricing: { completion: '0.00000350', prompt: '0.00000066' },
    pricing_display: { input: '$0.66/1M', output: '$3.50/1M' },
    provider: 'moonshotai',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 262142, is_moderated: false, max_completion_tokens: 262142 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'GPT' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 400000,
    created: 1773748178,
    description: 'Efficient GPT-5.4. High-throughput model with strong reasoning and coding.',
    id: 'openai/gpt-5.4-mini',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-5.4 Mini',
    per_request_limits: null,
    pricing: { completion: '0.00000450', prompt: '0.00000075' },
    pricing_display: { input: '$0.75/1M', output: '$4.50/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: false,
    supports_vision: true,
    top_provider: { context_length: 400000, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: null, modality: 'text->text', tokenizer: 'Other' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: false },
    category: 'reasoning',
    context_length: 1048576,
    created: 1781631930,
    description: 'Large-scale reasoner. Tuned for long-horizon agents and project-level engineering.',
    id: 'z-ai/glm-5.2',
    is_free: false,
    is_reasoning_model: true,
    name: 'GLM 5.2',
    per_request_limits: null,
    pricing: { completion: '0.00000410', prompt: '0.00000120' },
    pricing_display: { input: '$1.20/1M', output: '$4.10/1M' },
    provider: 'z-ai',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: false,
    top_provider: { context_length: 1048576, is_moderated: false, max_completion_tokens: 131072 },
  },
  {
    architecture: { instruct_type: null, modality: 'text->text', tokenizer: 'Qwen' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: false },
    category: 'general',
    context_length: 1000000,
    created: 1779376861,
    description: 'Flagship Qwen. Agent-centric model strong at coding and productivity tasks.',
    id: 'qwen/qwen3.7-max',
    is_free: false,
    is_reasoning_model: true,
    name: 'Qwen3.7 Max',
    per_request_limits: null,
    pricing: { completion: '0.00000375', prompt: '0.00000125' },
    pricing_display: { input: '$1.25/1M', output: '$3.75/1M' },
    provider: 'qwen',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: false,
    top_provider: { context_length: 1000000, is_moderated: false, max_completion_tokens: 65536 },
  },
  {
    architecture: { instruct_type: 'grok', modality: 'text+image->text', tokenizer: 'Grok' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'reasoning',
    context_length: 1000000,
    created: 1777591821,
    description: 'Reasoning model with X/Twitter access. Strong agentic and high-factuality tasks.',
    id: 'x-ai/grok-4.3',
    is_free: false,
    is_reasoning_model: true,
    name: 'Grok 4.3',
    per_request_limits: null,
    pricing: { completion: '0.00000250', prompt: '0.00000125' },
    pricing_display: { input: '$1.25/1M', output: '$2.50/1M' },
    provider: 'x-ai',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1000000, is_moderated: false, max_completion_tokens: 30000 },
  },
  {
    architecture: { instruct_type: 'grok', modality: 'text+image+file->text', tokenizer: 'Grok' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'reasoning',
    context_length: 2000000,
    created: 1774979019,
    description: 'Fast agentic reasoner. Lowest hallucination rate with a huge 2M-token context.',
    id: 'x-ai/grok-4.20',
    is_free: false,
    is_reasoning_model: true,
    name: 'Grok 4.20',
    per_request_limits: null,
    pricing: { completion: '0.00000250', prompt: '0.00000125' },
    pricing_display: { input: '$1.25/1M', output: '$2.50/1M' },
    provider: 'x-ai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 2000000, is_moderated: false, max_completion_tokens: 30000 },
  },
  {
    architecture: { instruct_type: 'gemini', modality: 'text+image+file+audio+video->text', tokenizer: 'Gemini' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1048576,
    created: 1779193800,
    description: 'High-efficiency multimodal. Near-Pro coding and reasoning at Flash-tier speed.',
    id: 'google/gemini-3.5-flash',
    is_free: false,
    is_reasoning_model: true,
    name: 'Gemini 3.5 Flash',
    per_request_limits: null,
    pricing: { completion: '0.00000900', prompt: '0.00000150' },
    pricing_display: { input: '$1.50/1M', output: '$9/1M' },
    provider: 'google',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1048576, is_moderated: false, max_completion_tokens: 65536 },
  },
  {
    architecture: { instruct_type: 'gemini', modality: 'text+image+video+audio+file->text', tokenizer: 'Gemini' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1048576,
    created: 1740441600,
    description: 'Top performer. Excels at complex reasoning across all domains.',
    id: 'google/gemini-2.5-pro',
    is_free: false,
    is_reasoning_model: true,
    name: 'Gemini 2.5 Pro',
    per_request_limits: null,
    pricing: { completion: '0.00001000', prompt: '0.00000125' },
    pricing_display: { input: '$1.25/1M', output: '$10/1M' },
    provider: 'google',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1048576, is_moderated: false, max_completion_tokens: 65536 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 400000,
    created: 1723075200,
    description: 'Premium intelligence. Exceptional at nuanced, complex tasks.',
    id: 'openai/gpt-5',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-5',
    per_request_limits: null,
    pricing: { completion: '0.00001000', prompt: '0.00000125' },
    pricing_display: { input: '$1.25/1M', output: '$10/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 400000, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 400000,
    created: 1748390400,
    description: 'Natural conversationalist. Thoughtful responses that feel human.',
    id: 'openai/gpt-5.1',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-5.1',
    per_request_limits: null,
    pricing: { completion: '0.00001000', prompt: '0.00000125' },
    pricing_display: { input: '$1.25/1M', output: '$10/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 400000, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 400000,
    created: 1733788800,
    description: 'Power user\'s choice. Handles complex projects and long documents.',
    id: 'openai/gpt-5.2',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-5.2',
    per_request_limits: null,
    pricing: { completion: '0.00001400', prompt: '0.00000175' },
    pricing_display: { input: '$1.75/1M', output: '$14/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 400000, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 400000,
    created: 1771509627,
    description: 'Agentic coding powerhouse. Optimized for software engineering workflows.',
    id: 'openai/gpt-5.3-codex',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-5.3 Codex',
    per_request_limits: null,
    pricing: { completion: '0.00001400', prompt: '0.00000175' },
    pricing_display: { input: '$1.75/1M', output: '$14/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 400000, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'reasoning',
    context_length: 200000,
    created: 1744761600,
    description: 'Ultimate problem solver. Excels at math, science, and coding challenges.',
    id: 'openai/o3',
    is_free: false,
    is_reasoning_model: true,
    name: 'OpenAI o3',
    per_request_limits: null,
    pricing: { completion: '0.00000800', prompt: '0.00000200' },
    pricing_display: { input: '$2/1M', output: '$8/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 200000, is_moderated: true, max_completion_tokens: 100000 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1047576,
    created: 1744675200,
    description: 'Versatile expert. Strong across writing, analysis, and coding.',
    id: 'openai/gpt-4.1',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-4.1',
    per_request_limits: null,
    pricing: { completion: '0.00000800', prompt: '0.00000200' },
    pricing_display: { input: '$2/1M', output: '$8/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1047576, is_moderated: true, max_completion_tokens: 32768 },
  },
  {
    architecture: { instruct_type: 'gemini', modality: 'text+image+file+audio+video->text', tokenizer: 'Gemini' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1048576,
    created: 1771509627,
    description: 'Multimedia master. Analyzes text, images, video, and audio together.',
    id: 'google/gemini-3.1-pro-preview',
    is_free: false,
    is_reasoning_model: true,
    name: 'Gemini 3.1 Pro Preview',
    per_request_limits: null,
    pricing: { completion: '0.00001200', prompt: '0.00000200' },
    pricing_display: { input: '$2/1M', output: '$12/1M' },
    provider: 'google',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1048576, is_moderated: false, max_completion_tokens: 65536 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1047576,
    created: 1771509627,
    description: 'Latest OpenAI flagship. Unified Codex/GPT architecture with 1M context.',
    id: 'openai/gpt-5.4',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-5.4',
    per_request_limits: null,
    pricing: { completion: '0.00001500', prompt: '0.00000250' },
    pricing_display: { input: '$2.50/1M', output: '$15/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1047576, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: 'grok', modality: 'text->text', tokenizer: 'Grok' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: false },
    category: 'general',
    context_length: 131072,
    created: 1736294400,
    description: 'Deep analyst with X/Twitter access. Real-time social data plus domain expertise.',
    id: 'x-ai/grok-3',
    is_free: false,
    is_reasoning_model: false,
    name: 'Grok 3',
    per_request_limits: null,
    pricing: { completion: '0.00001500', prompt: '0.00000300' },
    pricing_display: { input: '$3/1M', output: '$15/1M' },
    provider: 'x-ai',
    supports_file: false,
    supports_reasoning_stream: false,
    supports_temperature: true,
    supports_vision: false,
    top_provider: { context_length: 131072, is_moderated: false, max_completion_tokens: 16384 },
  },
  {
    architecture: { instruct_type: 'grok', modality: 'text+image->text', tokenizer: 'Grok' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'reasoning',
    context_length: 256000,
    created: 1752019200,
    description: 'Advanced reasoner with live data. X/Twitter integration for trending analysis and current events.',
    id: 'x-ai/grok-4',
    is_free: false,
    is_reasoning_model: true,
    name: 'Grok 4',
    per_request_limits: null,
    pricing: { completion: '0.00001500', prompt: '0.00000300' },
    pricing_display: { input: '$3/1M', output: '$15/1M' },
    provider: 'x-ai',
    supports_file: false,
    supports_reasoning_stream: false,
    supports_temperature: false,
    supports_vision: true,
    top_provider: { context_length: 256000, is_moderated: false, max_completion_tokens: 32768 },
  },
  {
    architecture: { instruct_type: 'claude', modality: 'text+image+file->text', tokenizer: 'Claude' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1000000,
    created: 1747958400,
    description: 'Coding champion. Excels at software development and agentic tasks.',
    id: 'anthropic/claude-sonnet-4',
    is_free: false,
    is_reasoning_model: false,
    name: 'Claude Sonnet 4',
    per_request_limits: null,
    pricing: { completion: '0.00001500', prompt: '0.00000300' },
    pricing_display: { input: '$3/1M', output: '$15/1M' },
    provider: 'anthropic',
    supports_file: true,
    supports_reasoning_stream: false,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1000000, is_moderated: false, max_completion_tokens: 16384 },
  },
  {
    architecture: { instruct_type: 'claude', modality: 'text+image+file->text', tokenizer: 'Claude' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1000000,
    created: 1771509627,
    description: 'Frontier Sonnet. Excels at iterative development and complex coding tasks.',
    id: 'anthropic/claude-sonnet-4.6',
    is_free: false,
    is_reasoning_model: true,
    name: 'Claude Sonnet 4.6',
    per_request_limits: null,
    pricing: { completion: '0.00001500', prompt: '0.00000300' },
    pricing_display: { input: '$3/1M', output: '$15/1M' },
    provider: 'anthropic',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1000000, is_moderated: false, max_completion_tokens: 64000 },
  },

  // ========================================================================
  // PRO TIER - Flagship premium models (>$5.00/M)
  // ========================================================================
  {
    architecture: { instruct_type: 'claude', modality: 'text+image+file->text', tokenizer: 'Claude' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1000000,
    created: 1779905091,
    description: 'Anthropic\'s most capable Opus. Reasoning powerhouse with a 1M-token context.',
    id: 'anthropic/claude-opus-4.8',
    is_free: false,
    is_reasoning_model: true,
    name: 'Claude Opus 4.8',
    per_request_limits: null,
    pricing: { completion: '0.00002500', prompt: '0.00000500' },
    pricing_display: { input: '$5/1M', output: '$25/1M' },
    provider: 'anthropic',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: false,
    supports_vision: true,
    top_provider: { context_length: 1000000, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'GPT' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1050000,
    created: 1777051893,
    description: 'OpenAI frontier model. Strong reasoning and reliability for complex pro work.',
    id: 'openai/gpt-5.5',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-5.5',
    per_request_limits: null,
    pricing: { completion: '0.00003000', prompt: '0.00000500' },
    pricing_display: { input: '$5/1M', output: '$30/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: false,
    supports_vision: true,
    top_provider: { context_length: 1050000, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: null, modality: 'text+image+file->text', tokenizer: 'Claude' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1000000,
    created: 1781007515,
    description: 'Mythos-class Claude. Built for autonomous knowledge work and coding.',
    id: 'anthropic/claude-fable-5',
    is_free: false,
    is_reasoning_model: true,
    name: 'Claude Fable 5',
    per_request_limits: null,
    pricing: { completion: '0.00005000', prompt: '0.00001000' },
    pricing_display: { input: '$10/1M', output: '$50/1M' },
    provider: 'anthropic',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: false,
    supports_vision: true,
    top_provider: { context_length: 1000000, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: 'claude', modality: 'text+image+file->text', tokenizer: 'Claude' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1000000,
    created: 1779913703,
    description: 'Fast-mode Opus 4.8. Identical capabilities with higher output speed.',
    id: 'anthropic/claude-opus-4.8-fast',
    is_free: false,
    is_reasoning_model: true,
    name: 'Claude Opus 4.8 (Fast)',
    per_request_limits: null,
    pricing: { completion: '0.00005000', prompt: '0.00001000' },
    pricing_display: { input: '$10/1M', output: '$50/1M' },
    provider: 'anthropic',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: false,
    supports_vision: true,
    top_provider: { context_length: 1000000, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'GPT' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'reasoning',
    context_length: 1050000,
    created: 1777051896,
    description: 'Deep-reasoning GPT-5.5. Highest accuracy for complex, high-stakes workloads.',
    id: 'openai/gpt-5.5-pro',
    is_free: false,
    is_reasoning_model: true,
    name: 'GPT-5.5 Pro',
    per_request_limits: null,
    pricing: { completion: '0.00018000', prompt: '0.00003000' },
    pricing_display: { input: '$30/1M', output: '$180/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: false,
    supports_vision: true,
    top_provider: { context_length: 1050000, is_moderated: true, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: 'claude', modality: 'text+image->text', tokenizer: 'Claude' },
    capabilities: { file: false, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 1000000,
    created: 1770219050,
    description: 'The ultimate agent. Excels at sustained workflows across large codebases.',
    id: 'anthropic/claude-opus-4.6',
    is_free: false,
    is_reasoning_model: true,
    name: 'Claude Opus 4.6',
    per_request_limits: null,
    pricing: { completion: '0.00002500', prompt: '0.00000500' },
    pricing_display: { input: '$5/1M', output: '$25/1M' },
    provider: 'anthropic',
    supports_file: false,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 1000000, is_moderated: false, max_completion_tokens: 128000 },
  },
  {
    architecture: { instruct_type: 'chatml', modality: 'text+image+file->text', tokenizer: 'o200k_base' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'reasoning',
    context_length: 200000,
    created: 1749598352,
    description: 'Maximum reasoning. For the most challenging problems requiring deep thought.',
    id: 'openai/o3-pro',
    is_free: false,
    is_reasoning_model: true,
    name: 'OpenAI o3 Pro',
    per_request_limits: null,
    pricing: { completion: '0.00008000', prompt: '0.00002000' },
    pricing_display: { input: '$20/1M', output: '$80/1M' },
    provider: 'openai',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: false,
    supports_vision: true,
    top_provider: { context_length: 200000, is_moderated: true, max_completion_tokens: 100000 },
  },
  {
    architecture: { instruct_type: 'claude', modality: 'text+image+file->text', tokenizer: 'Claude' },
    capabilities: { file: true, reasoning: true, streaming: true, tools: true, vision: true },
    category: 'general',
    context_length: 200000,
    created: 1747958400,
    description: 'Elite coder. The world\'s top model for software engineering.',
    id: 'anthropic/claude-opus-4',
    is_free: false,
    is_reasoning_model: true,
    name: 'Claude Opus 4',
    per_request_limits: null,
    pricing: { completion: '0.00007500', prompt: '0.00001500' },
    pricing_display: { input: '$15/1M', output: '$75/1M' },
    provider: 'anthropic',
    supports_file: true,
    supports_reasoning_stream: true,
    supports_temperature: true,
    supports_vision: true,
    top_provider: { context_length: 200000, is_moderated: false, max_completion_tokens: 32768 },
  },
];

// Derive HARDCODED_MODELS with computed tags + maxFileSizeMB from BASE_MODELS
export const HARDCODED_MODELS: readonly HardcodedModel[] = BASE_MODELS.map((model) => {
  const tags = deriveModelTags(model);
  const maxFileSizeMB = deriveMaxFileSizeMB(model.context_length);
  return { ...model, maxFileSizeMB, tags };
});

// ============================================================================
// USER-FACING MODELS - Curated list for UI selection (Dec 2025)
// ============================================================================

/**
 * ✅ USER-FACING MODELS: Best 6 multimodal models for perfect results
 *
 * Criteria:
 * - Multimodal support (vision + text)
 * - Top-tier quality and reliability
 * - Diverse price points for accessibility
 *
 * @see User request: "best models supporting multimodals now"
 */
export const USER_FACING_MODEL_IDS: readonly ModelId[] = [
  ModelIds.GOOGLE_GEMINI_2_5_FLASH, // $0.30/M - Fast, affordable multimodal
  ModelIds.GOOGLE_GEMINI_2_5_PRO, // $1.25/M - #1 on LMArena, flagship
  ModelIds.OPENAI_GPT_5_4, // $2.50/M - Latest OpenAI flagship, 1M context
  ModelIds.GOOGLE_GEMINI_3_1_PRO_PREVIEW, // $2/M - Gemini 3.1 flagship (preview)
  ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, // $3/M - Frontier Sonnet, iterative dev
  ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, // $5/M - Ultimate agent, sustained workflows
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all available models (for internal/system use)
 * Same models available in all environments (local, preview, production)
 */
export function getAllModels() {
  return HARDCODED_MODELS;
}

export function getModelById(modelId: string): HardcodedModel | undefined {
  const found = HARDCODED_MODELS.find(model => model.id === modelId);
  if (!found) {
    return undefined;
  }

  // Explicitly return as HardcodedModel to strip index signatures from Zod .openapi()
  return {
    architecture: found.architecture,
    capabilities: found.capabilities,
    category: found.category,
    context_length: found.context_length,
    created: found.created,
    description: found.description,
    id: found.id,
    is_free: found.is_free,
    is_reasoning_model: found.is_reasoning_model,
    maxFileSizeMB: found.maxFileSizeMB,
    name: found.name,
    per_request_limits: found.per_request_limits,
    pricing: found.pricing,
    pricing_display: found.pricing_display,
    provider: found.provider,
    streaming_behavior: found.streaming_behavior,
    supports_file: found.supports_file,
    supports_reasoning_stream: found.supports_reasoning_stream,
    supports_temperature: found.supports_temperature,
    supports_vision: found.supports_vision,
    tags: found.tags,
    top_provider: found.top_provider,
  } satisfies HardcodedModel;
}

export function extractModeratorModelName(modelId: string) {
  const model = getModelById(modelId);
  if (model) {
    return model.name;
  }

  const parts = modelId.split('/');
  const modelPart = parts[parts.length - 1] || modelId;

  return modelPart
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/\d{8}$/, '')
    .trim();
}

/**
 * ✅ GET STREAMING BEHAVIOR: Determines if model needs smoothStream normalization
 *
 * Returns the streaming behavior for a model:
 * - 'token': Streams token-by-token (OpenAI, Anthropic, Mistral) - no normalization needed
 * - 'buffered': Buffers server-side (xAI, DeepSeek, Gemini) - needs smoothStream normalization
 *
 * Priority:
 * 1. Model's explicit streaming_behavior (if set)
 * 2. Provider default from PROVIDER_STREAMING_DEFAULTS
 * 3. Fallback to 'token' (safe default - no normalization)
 */
export function getModelStreamingBehavior(modelId: string) {
  const model = getModelById(modelId);
  if (model?.streaming_behavior) {
    return model.streaming_behavior;
  }

  const provider = modelId.split('/')[0] || '';
  // Type-safe provider lookup using the enum's type guard
  if (provider in PROVIDER_STREAMING_DEFAULTS) {
    return PROVIDER_STREAMING_DEFAULTS[provider as keyof typeof PROVIDER_STREAMING_DEFAULTS];
  }
  return StreamingBehaviors.TOKEN;
}

/**
 * ✅ NEEDS SMOOTH STREAM: Quick check if model needs chunk normalization
 *
 * Returns true if the model buffers responses server-side and needs
 * smoothStream to normalize chunk delivery for consistent UI rendering.
 */
export function needsSmoothStream(modelId: string) {
  return getModelStreamingBehavior(modelId) === StreamingBehaviors.BUFFERED;
}

// ============================================================================
// MODEL FAMILY DETECTION HELPERS
// ============================================================================

/**
 * ✅ IS DEEPSEEK MODEL: Checks if model uses DeepSeek provider
 *
 * DeepSeek models use XML <think> tags for reasoning that require
 * extractReasoningMiddleware to extract properly.
 */
export function isDeepSeekModel(modelId: string) {
  const model = getModelById(modelId);
  if (model) {
    return model.provider === 'deepseek';
  }
  // Fallback for models not in hardcoded list
  return modelId.toLowerCase().startsWith('deepseek/');
}

/**
 * ✅ IS O-SERIES MODEL: Checks if model is OpenAI O-series reasoning model
 *
 * O-series models (o1, o3, o4) are reasoning-first and use native
 * reasoning via provider - no extractReasoningMiddleware needed.
 */
export function isOSeriesModel(modelId: string) {
  const model = getModelById(modelId);
  if (model) {
    // O-series models have is_reasoning_model=true and provider='openai'
    // Check if the model ID matches o1/o3/o4 pattern
    const modelName = modelId.split('/')[1] || '';
    return model.provider === 'openai' && /^o[134](?:-|$)/.test(modelName);
  }
  // Fallback for models not in hardcoded list
  return /^openai\/o[134](?:-|$)/.test(modelId);
}

/**
 * ✅ IS NANO OR MINI VARIANT: Checks if model is a lightweight variant
 *
 * Nano/mini variants have limited token budgets and should use
 * minimal reasoning effort to preserve tokens for output.
 */
export function isNanoOrMiniVariant(modelId: string) {
  const lowerModelId = modelId.toLowerCase();
  return lowerModelId.includes('nano') || lowerModelId.includes('mini');
}

/**
 * ✅ IS XAI MODEL: Checks if model is from xAI (Grok family)
 *
 * xAI models support native X/Twitter search via the OpenRouter web plugin,
 * giving them real-time access to tweets, trending topics, and breaking news.
 */
export function isXaiModel(modelId: string) {
  const model = getModelById(modelId);
  if (model) {
    return model.provider === 'x-ai';
  }
  // Fallback for models not in hardcoded list
  return modelId.startsWith('x-ai/');
}

/**
 * Below this output-token budget, reasoning models use 'low' effort so hidden
 * reasoning tokens can't consume the entire allowance before any visible text
 * is produced. At 'medium'/'high' effort with a tight budget (e.g. free tier =
 * 512), the model exhausts its tokens on reasoning and returns an empty turn
 * ("no response at all"). Ref: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
 */
const REASONING_LOW_EFFORT_BUDGET = 2048;

/**
 * ✅ BUILD OPENROUTER OPTIONS: Capability-based providerOptions for AI SDK streamText/generateText
 *
 * Centralizes model-specific OpenRouter options so callers don't need to
 * duplicate capability checks. Returns the `openrouter` sub-object for
 * spreading into `providerOptions: { openrouter: ... }`.
 *
 * - Reasoning models: effort scaled to the output budget to prevent token
 *   exhaustion on hidden reasoning (tight budget → 'low', else 'medium')
 * - xAI models: web plugin for native X/Twitter search
 *
 * @param modelId - The OpenRouter model id to build provider options for.
 * @param maxOutputTokens - The streamText maxOutputTokens for this call. When
 *   small, reasoning effort drops to 'low' so visible text always has headroom.
 */
export function buildOpenRouterOptions(modelId: string, maxOutputTokens?: number) {
  const model = getModelById(modelId);
  const isReasoning = model?.is_reasoning_model ?? false;
  const isXai = model?.provider === 'x-ai';

  if (!isReasoning && !isXai) {
    return undefined;
  }

  const effort = maxOutputTokens !== undefined && maxOutputTokens <= REASONING_LOW_EFFORT_BUDGET
    ? ('low' as const)
    : ('medium' as const);

  return {
    ...(isReasoning && { reasoning: { effort } }),
    ...(isXai && { plugins: [{ id: 'web' }] }),
  };
}

// ============================================================================
// MODEL TAG FILTERING
// ============================================================================

/**
 * ✅ GET MODEL TAGS: Returns the capability tags for a model
 */
export function getModelTags(modelId: string): ModelCapabilityTag[] {
  const model = getModelById(modelId);
  return model?.tags ?? [];
}

/**
 * ✅ MODEL HAS TAG: Check if a model has a specific capability tag
 */
export function modelHasTag(modelId: string, tag: ModelCapabilityTag) {
  return getModelTags(modelId).includes(tag);
}

/**
 * ✅ MODEL HAS ALL TAGS: Check if a model has all specified tags
 */
export function modelHasAllTags(modelId: string, tags: ModelCapabilityTag[]) {
  const modelTags = getModelTags(modelId);
  return tags.every(tag => modelTags.includes(tag));
}

/**
 * ✅ FILTER MODELS BY TAGS: Get models that have all specified tags
 */
export function filterModelsByTags<T extends { id: string }>(
  models: T[],
  requiredTags: ModelCapabilityTag[],
): T[] {
  if (requiredTags.length === 0) {
    return models;
  }
  return models.filter(model => modelHasAllTags(model.id, requiredTags));
}
