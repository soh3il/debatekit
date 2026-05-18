/**
 * MCP Model Router
 *
 * Routes prompts to optimal model combinations based on domain detection.
 * Uses keyword matching and historical quality scores to select models.
 */

import { createDb } from '@debatekit/db/factory';
import { mcpSession } from '@debatekit/db/tables';
import type { McpThinkingLevel } from '@debatekit/shared/enums';
import { and, avg, count, eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { Env } from '../types';
import { THINKING_PRESETS } from './presets';

// ============================================================================
// Domain Detection
// ============================================================================

const DOMAIN_VALUES = ['architecture', 'backend', 'devops', 'frontend', 'general', 'security'] as const;
const DomainSchema = z.enum(DOMAIN_VALUES);
type Domain = z.infer<typeof DomainSchema>;

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  architecture: ['architect', 'design', 'infrastructure', 'microservice', 'monolith', 'scalab', 'system design'],
  backend: ['api', 'backend', 'database', 'endpoint', 'migration', 'query', 'rest', 'server', 'sql'],
  devops: ['ci/cd', 'deploy', 'docker', 'kubernetes', 'monitoring', 'pipeline', 'terraform'],
  frontend: ['component', 'css', 'frontend', 'react', 'responsive', 'tailwind', 'ui', 'ux'],
  general: [],
  security: ['auth', 'cors', 'csrf', 'encryption', 'oauth', 'permission', 'security', 'vulnerab', 'xss'],
};

function detectDomain(prompt: string): Domain {
  const lower = prompt.toLowerCase();
  let bestDomain: Domain = 'general';
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (domain === 'general') {
      continue;
    }

    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score++;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestDomain = DomainSchema.parse(domain);
    }
  }

  return bestDomain;
}

// ============================================================================
// Model Selection
// ============================================================================

/**
 * Get optimal models based on domain and thinking level.
 * Uses historical quality scores from sessions when available,
 * otherwise falls back to preset defaults.
 */
async function getOptimalModels(
  env: Env,
  _domain: Domain,
  level: McpThinkingLevel,
) {
  // Try to find best-performing model combos from session history
  try {
    const db = createDb(env.DB);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        avgScore: avg(mcpSession.qualityScore).mapWith(Number),
        count: count(),
        modelIdsJson: mcpSession.modelIdsJson,
      })
      .from(mcpSession)
      .where(
        and(
          eq(mcpSession.thinkingLevel, level),
          sql`${mcpSession.qualityScore} IS NOT NULL`,
          eq(mcpSession.evaluationStatus, 'completed'),
          gt(mcpSession.createdAt, thirtyDaysAgo),
        ),
      )
      .groupBy(mcpSession.modelIdsJson)
      .having(sql`${count()} >= 3`)
      .orderBy(sql`${avg(mcpSession.qualityScore)} DESC`)
      .limit(1);

    const row = rows[0];
    if (row?.modelIdsJson) {
      const parsed = z.array(z.string()).min(3).safeParse(
        JSON.parse(String(row.modelIdsJson)),
      );
      if (parsed.success) {
        return {
          modelIds: parsed.data,
          reason: `historical best (avg score: ${row.avgScore.toFixed(1)}, ${row.count} sessions)`,
        };
      }
    }
  } catch {
    // DB error -- fall through to defaults
  }

  // Fall back to preset defaults
  const preset = THINKING_PRESETS[level];
  return {
    modelIds: preset.defaultModels,
    reason: `default preset for ${level} level`,
  };
}

// ============================================================================
// Route Models (full pipeline)
// ============================================================================

export async function routeModels(
  env: Env,
  prompt: string,
  level: McpThinkingLevel,
) {
  const domain = detectDomain(prompt);
  const result = await getOptimalModels(env, domain, level);

  return {
    domain,
    modelIds: result.modelIds,
    reason: result.reason,
  };
}
