/**
 * MCP Prompt Template Resolver
 *
 * Thin wrapper over @debatekit/db shared service.
 * Manages versioned prompt templates stored in D1.
 * Falls back to hardcoded defaults when no DB template exists.
 */

import { createDb } from '@debatekit/db/factory';
import {
  incrementUsage as _incrementUsage,
  resolvePrompt as _resolvePrompt,
} from '@debatekit/db/services';
import type { McpPromptTemplateType } from '@debatekit/shared/enums';

import type { Env } from '../types';

// ============================================================================
// Template Resolution
// ============================================================================

async function resolvePrompt(env: Env, toolName: string, templateType: McpPromptTemplateType) {
  return _resolvePrompt(createDb(env.DB), toolName, templateType);
}

// ============================================================================
// Usage Tracking
// ============================================================================

async function incrementTemplateUsage(env: Env, templateId: string) {
  return _incrementUsage(createDb(env.DB), templateId);
}

// ============================================================================
// Get or Fallback
// ============================================================================

/**
 * Try to resolve a template from DB, fall back to hardcoded default.
 * Returns { text, version, templateId } where version is null for fallbacks.
 */
export async function getOrFallback(
  env: Env,
  toolName: string,
  templateType: McpPromptTemplateType,
  fallbackText: string,
) {
  try {
    const template = await resolvePrompt(env, toolName, templateType);

    if (template) {
      // Fire-and-forget usage increment
      incrementTemplateUsage(env, template.id).catch(() => {});

      return {
        templateId: template.id,
        text: template.templateText,
        version: template.version,
      };
    }
  } catch {
    // DB error -- fall through to fallback
  }

  return {
    templateId: null as string | null,
    text: fallbackText,
    version: null as number | null,
  };
}
