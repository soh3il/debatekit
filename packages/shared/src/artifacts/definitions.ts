/**
 * Artifact Definitions
 *
 * Typed artifact schemas for @ai-sdk-tools/artifacts streaming.
 * Used by both backend (`.stream()`) and frontend (`useArtifact()`).
 *
 * Reuses existing Zod schemas from unified-round-stream types.
 *
 * @module shared/artifacts/definitions
 */

import { artifact } from '@ai-sdk-tools/artifacts';
import { z } from 'zod';

import {
  AvailableSourcesDataSchema,
  PresearchQueryDataSchema,
  PresearchResultDataSchema,
} from '../types/unified-round-stream';

/**
 * Presearch artifact — accumulates queries + results as they arrive.
 *
 * Backend creates via `.stream(initialData, writer)`, then `.update()` per
 * query/result, finally `.complete()`. Frontend reads via `useArtifact()`.
 */
export const presearchArtifact = artifact(
  'presearch',
  z.object({
    queries: z.array(PresearchQueryDataSchema),
    results: z.array(PresearchResultDataSchema),
    summary: z.string(),
    totalResults: z.number(),
  }),
);

/**
 * Available sources artifact — one-shot citation data sent at participant start.
 *
 * Backend creates + immediately completes. Frontend reads via `useArtifact()`.
 */
export const availableSourcesArtifact = artifact(
  'available-sources',
  AvailableSourcesDataSchema,
);
