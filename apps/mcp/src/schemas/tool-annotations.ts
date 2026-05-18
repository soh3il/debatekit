/**
 * Centralized MCP tool annotation presets.
 *
 * ToolAnnotations are hints that help clients decide how to present/execute tools.
 * See MCP SDK v1.26.0 ToolAnnotationsSchema for full spec.
 */

import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

/** Debate tools consume credits, call external LLM APIs, are non-deterministic */
export const DEBATE_ANNOTATIONS = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
  readOnlyHint: false,
} as const satisfies ToolAnnotations;

/** Read-only tools: no side-effects, safe to retry, no external calls */
export const READ_ONLY_ANNOTATIONS = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
} as const satisfies ToolAnnotations;

/** Mutating tools: changes state but is idempotent (same input → same outcome) */
export const MUTATING_ANNOTATIONS = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: false,
} as const satisfies ToolAnnotations;
