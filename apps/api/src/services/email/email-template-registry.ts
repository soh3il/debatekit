/**
 * Email Template Registry
 *
 * Maps template IDs to React Email component render functions.
 * Templates are registered at startup; the registry is queried
 * by the queue consumer to render emails before sending.
 */

import type { EmailTemplateId } from '@debatekit/shared/enums';
import * as z from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export const TemplateVarsSchema = z.record(z.string(), z.string());
export type TemplateVars = z.infer<typeof TemplateVarsSchema>;

type TemplateRenderer = (vars: TemplateVars) => {
  html: string;
  subject: string;
  text: string;
};

// ============================================================================
// REGISTRY
// ============================================================================

const registry = new Map<EmailTemplateId, TemplateRenderer>();

/**
 * Register a template renderer for a given template ID.
 * Called at startup to populate the registry.
 */
export function registerTemplate(id: EmailTemplateId, renderer: TemplateRenderer) {
  registry.set(id, renderer);
}

/**
 * Get the renderer for a template ID. Throws if not registered.
 */
export function getTemplateRenderer(id: EmailTemplateId) {
  const renderer = registry.get(id);
  if (!renderer) {
    throw new Error(`No template registered for ID: ${id}`);
  }
  return renderer;
}

/**
 * Check if a template is registered.
 */
export function hasTemplate(id: EmailTemplateId) {
  return registry.has(id);
}
