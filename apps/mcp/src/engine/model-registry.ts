import { getMultiplierForModelId } from '@debatekit/shared';
import { MCP_THINKING_LEVELS } from '@debatekit/shared/enums';
import { z } from 'zod';

import type { Env } from '../types';
import { THINKING_PRESETS } from './presets';

// ============================================================================
// Schemas & Types
// ============================================================================

const MODEL_CAPABILITIES = ['reasoning', 'coding', 'creative', 'analysis', 'math', 'multilingual'] as const;

const ModelRegistryEntrySchema = z.object({
  capabilities: z.array(z.enum(MODEL_CAPABILITIES)),
  id: z.string(),
  multiplier: z.number(),
  name: z.string(),
  provider: z.string(),
});
type ModelRegistryEntry = z.infer<typeof ModelRegistryEntrySchema>;

const RegistryManifestSchema = z.object({
  models: z.array(ModelRegistryEntrySchema),
  updatedAt: z.number(),
  version: z.number(),
});

// ============================================================================
// KV Keys
// ============================================================================

const REGISTRY_MANIFEST_KEY = 'mcp:model-registry:manifest';
const REGISTRY_MODEL_PREFIX = 'mcp:model-registry:model:';

// ============================================================================
// Default Capabilities (by known model patterns)
// ============================================================================

function inferCapabilities(modelId: string) {
  const id = modelId.toLowerCase();
  const caps: z.infer<typeof ModelRegistryEntrySchema>['capabilities'] = [];

  if (id.includes('claude') || id.includes('gpt') || id.includes('gemini')) {
    caps.push('reasoning', 'coding', 'analysis');
  }
  if (id.includes('opus') || id.includes('o3') || id.includes('pro')) {
    caps.push('math');
  }
  if (id.includes('claude') || id.includes('gpt-4')) {
    caps.push('creative');
  }
  if (id.includes('deepseek')) {
    caps.push('coding', 'math', 'reasoning');
  }
  if (id.includes('flash') || id.includes('mini')) {
    caps.push('analysis');
  }

  return [...new Set(caps)] as typeof caps;
}

function extractProvider(modelId: string) {
  return modelId.split('/')[0] ?? 'unknown';
}

function extractName(modelId: string) {
  const parts = modelId.split('/');
  const name = parts[parts.length - 1] ?? modelId;
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// Registry Operations
// ============================================================================

/** Set a single model entry in KV */
async function setRegistryEntry(env: Env, entry: ModelRegistryEntry) {
  await env.KV.put(
    `${REGISTRY_MODEL_PREFIX}${entry.id}`,
    JSON.stringify(entry),
  );
}

/** Get all registry models from manifest */
export async function getAllRegistryModels(env: Env) {
  const raw = await env.KV.get(REGISTRY_MANIFEST_KEY);
  if (!raw) {
    return [];
  }
  const manifest = RegistryManifestSchema.parse(JSON.parse(raw));
  return manifest.models;
}

/** Seed registry from existing THINKING_PRESETS */
async function seedRegistryFromPresets(env: Env) {
  const seenIds = new Set<string>();
  const models: ModelRegistryEntry[] = [];

  for (const level of MCP_THINKING_LEVELS) {
    const preset = THINKING_PRESETS[level];
    const allModels = [...preset.defaultModels, preset.moderatorModel];

    for (const modelId of allModels) {
      if (seenIds.has(modelId)) {
        continue;
      }
      seenIds.add(modelId);

      const entry: ModelRegistryEntry = {
        capabilities: inferCapabilities(modelId),
        id: modelId,
        multiplier: getMultiplierForModelId(modelId),
        name: extractName(modelId),
        provider: extractProvider(modelId),
      };

      models.push(entry);
      await setRegistryEntry(env, entry);
    }
  }

  const manifest = {
    models,
    updatedAt: Date.now(),
    version: 1,
  };
  await env.KV.put(REGISTRY_MANIFEST_KEY, JSON.stringify(manifest));

  return models;
}

/** Lazy-init: seed registry if manifest doesn't exist yet */
export async function ensureRegistry(env: Env) {
  const existing = await env.KV.get(REGISTRY_MANIFEST_KEY);
  if (existing) {
    return;
  }
  await seedRegistryFromPresets(env);
}
