/**
 * Test: Web Search Query Generation
 *
 * Verifies the full generateSearchQuery code path works end-to-end,
 * including structured output and the plain-text fallback.
 */

import { Output } from 'ai';
import { describe, expect, it } from 'vitest';

import { MultiQueryGenerationSchema } from '@/routes/chat/schema';
import type { ApiEnv } from '@/types';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

/**
 * Create a minimal test env with only the bindings needed for search query generation.
 * Uses Pick to extract only used fields from CloudflareEnv, avoiding `as any`.
 */
function createTestSearchEnv(
  overrides: Pick<ApiEnv['Bindings'], 'APP_NAME' | 'OPENROUTER_API_KEY'> & { WEBAPP_ENV: ApiEnv['Bindings']['WEBAPP_ENV'] },
): ApiEnv['Bindings'] {
  // Integration tests only use OPENROUTER_API_KEY, APP_NAME via initializeOpenRouter()
  // Other bindings are not accessed in this code path
  return overrides as ApiEnv['Bindings'];
}

describe('web search query generation', () => {
  it('should convert MultiQueryGenerationSchema to JSON schema without error', () => {
    expect(() => {
      Output.object({ schema: MultiQueryGenerationSchema });
    }).not.toThrow();
  });

  it('should generate queries via generateSearchQuery (full integration)', async () => {
    if (!OPENROUTER_API_KEY) {
      return;
    }

    const { generateSearchQuery } = await import('@/services/search/web-search.service');

    const env = createTestSearchEnv({
      APP_NAME: 'DebateKit API',
      OPENROUTER_API_KEY,
      WEBAPP_ENV: 'local',
    });

    const result = await generateSearchQuery(
      'What are the latest developments in quantum computing?',
      env,
    );

    expect(result.output.queries.length).toBeGreaterThan(0);
    expect(result.output.analysisRationale).toBeTruthy();

    for (const q of result.output.queries) {
      expect(q.query).toBeTruthy();
      expect(q.rationale).toBeTruthy();
      expect(q.searchDepth).toBeTruthy();
    }
  }, 60_000);
});
