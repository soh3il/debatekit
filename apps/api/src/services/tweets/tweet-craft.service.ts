/**
 * Tweet Craft Service
 *
 * Generates tweet content from completed debatekit threads using AI.
 * Applies marketing/copywriting principles (hook, value prop, CTA)
 * and Twitter/X rhetoric (curiosity gap, social proof, engagement bait).
 *
 * Uses OpenRouter via AI SDK for generation.
 */

import { extractTextFromMessage } from '@debatekit/shared';
import { ErrorContextTypes, MessagePartTypes, MessageRoles, ModelIds, UIMessageRoles } from '@debatekit/shared/enums';
import { and, desc, eq } from 'drizzle-orm';

import { createError } from '@/common/error-handling';
import type { ErrorContext } from '@/core';
import { isAppError } from '@/core';
import type { getDbAsync } from '@/db';
import * as tables from '@/db';
import { isModeratorMessageMetadata } from '@/db/schemas/chat-metadata';
import { getAppBaseUrl } from '@/lib/config/base-urls';
import { log } from '@/lib/logger';
import { getMessageMetadata } from '@/lib/utils/metadata';
import { resolveSkillTokens } from '@/services/admin/skill-registry';
import { getAdminSetting } from '@/services/admin-settings.service';
import { initializeOpenRouter, openRouterService } from '@/services/models';
import type { ApiEnv } from '@/types';

import { analyzePerformance, formatPerformanceForTweetCraft } from '../pipeline/performance-analysis.service';
import { getTopPerformingStyles } from './engagement-tracker.service';
import { TWEET_CHARACTER_RULES } from './tweet-skills';
import { calculateTweetLength } from './twitter-api.service';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_INSIGHT_LENGTH = 1500;
const MAX_MODERATOR_MESSAGES = 3;
/** 280 for standard accounts, 25000 for X Premium */
const MAX_TWEET_LENGTH = 280;
const TWEET_CRAFT_MODEL_ID = ModelIds.GOOGLE_GEMINI_2_5_FLASH;
/** Max retry attempts when generated tweet exceeds character limit */
const MAX_LENGTH_RETRIES = 3;

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function buildSystemPrompt(url: string, title: string, insights: string, debateData: string, tweetStyle: typeof TWEET_STYLES[number], trendContext?: string, adminPrompt?: string, customSkillsPrompt?: string, performanceContext?: string) {
  const adminSection = adminPrompt?.trim()
    ? `=== ADMIN INSTRUCTIONS ===\n${adminPrompt.trim()}\n\n`
    : '';

  const trendSection = trendContext
    ? `\n=== TRENDING CONTEXT ===\n${trendContext}\nIf any trending topic is relevant to this thread, weave it into the tweet naturally for extra reach. Do NOT force it — only reference trends that genuinely connect.\n`
    : '';

  const performanceSection = performanceContext?.trim()
    ? `\n${performanceContext.trim()}\n`
    : '';

  return `${adminSection}You are the voice of DebateKit HQ (@debatekitnow). You write tweets that go viral.
Your tweets sound like a REAL PERSON — never like a brand, a bot, or an AI.

=== HARD RULES ===
- MAXIMUM ${MAX_TWEET_LENGTH} characters total. This is a HARD LIMIT — tweets over this WILL FAIL.
- Twitter/X wraps ALL URLs to exactly ${TWEET_CHARACTER_RULES.tcoUrlLength} characters via t.co — the raw URL length does NOT matter. A 100-character URL still only counts as ${TWEET_CHARACTER_RULES.tcoUrlLength} characters toward the limit.
- Budget ${TWEET_CHARACTER_RULES.safeContentBudget} characters for your text. The URL takes ${TWEET_CHARACTER_RULES.tcoUrlLength} + a space/newline = ~25 chars.
- You MUST include the thread URL somewhere in the tweet (not as the first thing).
- Start with a SCROLL-STOPPING hook — the first line decides everything.
- Focus on the MOST SURPRISING or CONTROVERSIAL insight from the discussion.
- Make the reader physically UNABLE to not click the link.
- Output ONLY the tweet text. Nothing else. No quotes around it.

=== TWEET STYLE: ${tweetStyle.id.toUpperCase()} ===
${tweetStyle.description}
You MUST write this tweet in the "${tweetStyle.id}" style. This is non-negotiable.

${customSkillsPrompt || ''}
${performanceSection}
${debateData}
${trendSection}
=== THREAD CONTEXT ===
Thread URL: ${url}
Thread title: ${title}

Key insights from the AI debatekit discussion:
${insights}

Generate ONE tweet. Apply the copywriting frameworks, data-driven strategies, and psychology techniques above. Use debate data (agreement counts, dissenting views) when available. The tweet MUST pass the humanizer rules — no AI-sounding language.`;
}

// ============================================================================
// ERROR HELPERS
// ============================================================================

function createTweetCraftErrorContext(operation: string): ErrorContext {
  return {
    errorType: ErrorContextTypes.EXTERNAL_SERVICE,
    operation,
    serviceName: 'tweet-craft',
  };
}

// ============================================================================
// STYLE DIVERSITY
// ============================================================================

/** All available tweet styles with descriptions */
const TWEET_STYLES = [
  { description: 'Bold, contrarian opinion that sparks debate. Start with "Unpopular opinion:" or "Hot take:"', id: 'hot-take' },
  { description: 'Lead with specific numbers, percentages, or debate outcome stats. Make data the hook.', id: 'data-driven' },
  { description: 'Mini narrative arc: setup → tension → resolution. Personal/relatable angle.', id: 'storytelling' },
  { description: 'Open with a provocative question that makes readers stop and think. End with the thread link as the answer.', id: 'question-hook' },
  { description: 'Challenge a common assumption. "Everyone thinks X. They\'re wrong. Here\'s why:"', id: 'myth-buster' },
  { description: 'Old way vs new way. Before/after. Show contrast to highlight insight value.', id: 'comparison' },
  { description: 'Ultra-short, punchy statement followed by context. Under 100 chars for the hook.', id: 'one-liner-punch' },
  { description: 'Tease the most surprising or controversial finding from the AI debate without spoiling it.', id: 'thread-teaser' },
  { description: 'Format as if quoting an insight from the debate. "One AI model said something wild:"', id: 'quote-style' },
  { description: 'Numbered key takeaways (2-3 max). Quick-scan format that drives saves and bookmarks.', id: 'listicle' },
] as const;

export type TweetStyleId = typeof TWEET_STYLES[number]['id'];

/**
 * Select a tweet style, weighted by engagement performance.
 * New/untested styles get exploration bonus to ensure diversity.
 * Top performers get 2x weight to double down on what works.
 */
async function selectTweetStyle(
  db: Awaited<ReturnType<typeof getDbAsync>>,
): Promise<typeof TWEET_STYLES[number]> {
  let topStyles: Array<{ avgEngagementRate: number; count: number; style: string }> = [];

  try {
    topStyles = await getTopPerformingStyles(db);
  } catch {
    // Fall back to random selection if engagement data unavailable
  }

  // Build weighted selection
  const weights = new Map<string, number>();
  const BASE_WEIGHT = 10;
  const EXPLORATION_BONUS = 5; // untested styles get extra weight

  for (const style of TWEET_STYLES) {
    const perfData = topStyles.find(s => s.style === style.id);

    if (!perfData || perfData.count === 0) {
      // Never tested: give exploration bonus
      weights.set(style.id, BASE_WEIGHT + EXPLORATION_BONUS);
    } else if (perfData.avgEngagementRate > 3) {
      // High performer (>3% engagement): double weight
      weights.set(style.id, BASE_WEIGHT * 2);
    } else if (perfData.avgEngagementRate > 1.5) {
      // Good performer: normal weight
      weights.set(style.id, BASE_WEIGHT);
    } else {
      // Low performer: reduced but not zero (still try occasionally)
      weights.set(style.id, Math.max(BASE_WEIGHT / 2, 3));
    }
  }

  // Weighted random selection
  const totalWeight = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (const style of TWEET_STYLES) {
    const weight = weights.get(style.id) ?? BASE_WEIGHT;
    random -= weight;
    if (random <= 0) {
      return style;
    }
  }

  // Fallback: first style (guaranteed to exist)
  return TWEET_STYLES[0];
}

// ============================================================================
// INSIGHT EXTRACTION
// ============================================================================

/**
 * Extract key insights from moderator messages.
 * Moderator messages contain summaries/synthesis of the debatekit discussion.
 * They are identified by isModerator: true in metadata.
 */
function extractInsightsFromMessages(
  messages: (typeof tables.chatMessage.$inferSelect)[],
) {
  const insights = messages
    .map(m => extractTextFromMessage({ parts: m.parts }))
    .filter(text => text.length > 0)
    .join('\n\n---\n\n');

  if (insights.length > MAX_INSIGHT_LENGTH) {
    return `${insights.slice(0, MAX_INSIGHT_LENGTH)}...`;
  }

  return insights;
}

// ============================================================================
// DEBATE METRICS EXTRACTION
// ============================================================================

/**
 * Structured debate metrics parsed from moderator summaries.
 * Gives the AI concrete stats to work with for data-driven tweets.
 */
type DebateMetrics = {
  agreementCount: number;
  disagreementCount: number;
  keyDisagreements: string[];
  participantCount: number;
  surprisingOutcomes: string[];
};

/**
 * Parse moderator messages for agreement counts, key disagreements,
 * and surprising outcomes. Uses simple pattern matching on moderator
 * summary text to extract debate structure.
 */
function extractDebateMetrics(
  messages: (typeof tables.chatMessage.$inferSelect)[],
): DebateMetrics {
  const metrics: DebateMetrics = {
    agreementCount: 0,
    disagreementCount: 0,
    keyDisagreements: [],
    participantCount: 0,
    surprisingOutcomes: [],
  };

  for (const msg of messages) {
    const text = extractTextFromMessage({ parts: msg.parts }).toLowerCase();

    // Count agreement/disagreement signals
    const agreeMatches = text.match(/\bagree[ds]?\b|\bconsensus\b|\bunanimous\b|\baligned\b/g);
    const disagreeMatches = text.match(/\bdisagree[ds]?\b|\bdissent\b|\bcontested\b|\bsplit\b|\bdivided\b|\bpushed back\b|\bchallenged\b/g);

    if (agreeMatches) {
      metrics.agreementCount += agreeMatches.length;
    }
    if (disagreeMatches) {
      metrics.disagreementCount += disagreeMatches.length;
    }

    // Extract key disagreements from phrases like "disagreed on X" or "split on X"
    const disagreementPhrases = text.match(/(?:disagree[ds]?\s+(?:on|about|over|with)|split\s+on|debated\s+whether)\s+([^.!?\n]{10,80})/g);
    if (disagreementPhrases) {
      for (const phrase of disagreementPhrases.slice(0, 3)) {
        metrics.keyDisagreements.push(phrase.trim());
      }
    }

    // Extract surprising outcomes
    const surprisePatterns = text.match(/(?:surpris\w+|unexpected\w*|contrary to|interestingly|notably)\s*[,:]\s*([^.!?\n]{10,100})/g);
    if (surprisePatterns) {
      for (const pattern of surprisePatterns.slice(0, 2)) {
        metrics.surprisingOutcomes.push(pattern.trim());
      }
    }

    // Count participants mentioned (e.g., "GPT-4o", "Claude", "Gemini")
    const modelMentions = text.match(/\b(?:gpt|claude|gemini|llama|mistral|deepseek|qwen)\b/gi);
    if (modelMentions) {
      const uniqueModels = new Set(modelMentions.map(m => m.toLowerCase()));
      metrics.participantCount = Math.max(metrics.participantCount, uniqueModels.size);
    }
  }

  return metrics;
}

/**
 * Format debate metrics into a structured prompt section.
 * Only includes sections with actual data to avoid noise.
 */
function formatDebateMetricsForPrompt(metrics: DebateMetrics) {
  const lines: string[] = ['=== DEBATE DATA ==='];

  if (metrics.participantCount > 0) {
    lines.push(`Models in debate: ${metrics.participantCount}`);
  }

  if (metrics.agreementCount > 0 || metrics.disagreementCount > 0) {
    const total = metrics.agreementCount + metrics.disagreementCount;
    const agreePct = total > 0 ? Math.round((metrics.agreementCount / total) * 100) : 0;
    lines.push(`Agreement signals: ${metrics.agreementCount} (~${agreePct}%)`);
    lines.push(`Disagreement signals: ${metrics.disagreementCount}`);
  }

  if (metrics.keyDisagreements.length > 0) {
    lines.push('Key disagreements:');
    for (const d of metrics.keyDisagreements) {
      lines.push(`- ${d}`);
    }
  }

  if (metrics.surprisingOutcomes.length > 0) {
    lines.push('Surprising outcomes:');
    for (const s of metrics.surprisingOutcomes) {
      lines.push(`- ${s}`);
    }
  }

  // Only return the section if we found meaningful data
  return lines.length > 1 ? lines.join('\n') : '';
}

// ============================================================================
// POST-PROCESSING SAFETY NET
// ============================================================================

/** Regex matching http/https URLs in tweet content */
const URL_REGEX = /https?:\/\/\S+/g;

/**
 * Ensure the tweet contains the public URL and fits within the character limit.
 *
 * This is a programmatic safety net applied AFTER AI generation. It handles:
 * 1. URL missing from generated text → appends it
 * 2. Tweet over limit → trims text content (preserves URL)
 * 3. Edge cases where AI miscounts characters
 *
 * Twitter wraps ALL URLs to exactly 23 chars via t.co, so the raw URL length
 * (even with very long thread slugs) does NOT affect the character count.
 */
function ensureTweetFitsWithUrl(rawTweet: string, publicUrl: string): string {
  let tweet = rawTweet.trim();

  // 1. Ensure the public URL is in the tweet
  const hasUrl = tweet.includes(publicUrl) || URL_REGEX.test(tweet);
  if (!hasUrl) {
    tweet = `${tweet}\n\n${publicUrl}`;
  }

  // 2. Check length
  const effectiveLength = calculateTweetLength(tweet);
  if (effectiveLength <= MAX_TWEET_LENGTH) {
    return tweet;
  }

  // 3. Over limit — trim text content, preserving the URL
  // Extract URLs from the tweet to protect them
  const urls = tweet.match(URL_REGEX) || [];
  const urlPlaceholder = '\u0000URL\u0000';

  // Replace URLs with short placeholders
  let textOnly = tweet;
  for (const url of urls) {
    textOnly = textOnly.replace(url, urlPlaceholder);
  }

  // Calculate how many chars we need to trim from text
  const overBy = effectiveLength - MAX_TWEET_LENGTH;
  // Trim from end of text (before last URL placeholder if possible)
  const lastPlaceholderIdx = textOnly.lastIndexOf(urlPlaceholder);
  if (lastPlaceholderIdx > 0) {
    // Trim text before the last URL
    const textBefore = textOnly.slice(0, lastPlaceholderIdx).trimEnd();
    const trimTarget = textBefore.length - overBy - 1; // -1 for ellipsis
    if (trimTarget > 50) {
      // Find a word boundary near the trim point
      const trimmed = textBefore.slice(0, trimTarget);
      const lastSpace = trimmed.lastIndexOf(' ');
      const cutPoint = lastSpace > trimTarget - 20 ? lastSpace : trimTarget;
      textOnly = `${textBefore.slice(0, cutPoint)}…${textOnly.slice(lastPlaceholderIdx)}`;
    }
  } else {
    // No URL placeholder found — trim from end and append URL
    const trimTarget = MAX_TWEET_LENGTH - 23 - 2; // 23 for t.co URL, 2 for \n\n
    const trimmed = textOnly.slice(0, trimTarget);
    const lastSpace = trimmed.lastIndexOf(' ');
    const cutPoint = lastSpace > trimTarget - 20 ? lastSpace : trimTarget;
    textOnly = `${trimmed.slice(0, cutPoint)}…\n\n${urlPlaceholder}`;
  }

  // Restore URLs
  let result = textOnly;
  for (const url of urls) {
    result = result.replace(urlPlaceholder, url);
  }
  // If we added a placeholder for the public URL, restore it
  if (result.includes(urlPlaceholder)) {
    result = result.replace(urlPlaceholder, publicUrl);
  }

  return result;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate tweet content from a completed debatekit thread.
 *
 * 1. Loads thread from DB (title, mode)
 * 2. Loads last 2-3 moderator messages (summaries/insights)
 * 3. Calls AI with copywriting/marketing system prompt
 * 4. Returns generated tweet text
 */
export async function craftTweetFromThread(
  threadId: string,
  threadSlug: string,
  db: Awaited<ReturnType<typeof getDbAsync>>,
  env: ApiEnv['Bindings'],
  trendContext?: string,
): Promise<{ style: TweetStyleId; text: string }> {
  const thread = await db.query.chatThread.findFirst({
    columns: { mode: true, title: true },
    where: eq(tables.chatThread.id, threadId),
  });

  if (!thread) {
    throw createError.notFound(
      'Thread not found',
      createTweetCraftErrorContext('craft_tweet'),
    );
  }

  // Load assistant messages, then filter for moderator via Zod-validated metadata
  const allAssistantMessages = await db
    .select()
    .from(tables.chatMessage)
    .where(
      and(
        eq(tables.chatMessage.threadId, threadId),
        eq(tables.chatMessage.role, MessageRoles.ASSISTANT),
      ),
    )
    .orderBy(desc(tables.chatMessage.createdAt));

  const moderatorMessages = allAssistantMessages
    .filter((m) => {
      const meta = getMessageMetadata(m.metadata);
      return meta !== undefined && isModeratorMessageMetadata(meta);
    })
    .slice(0, MAX_MODERATOR_MESSAGES);

  if (moderatorMessages.length === 0) {
    throw createError.badRequest(
      'Thread has no completed rounds',
      createTweetCraftErrorContext('craft_tweet'),
    );
  }

  const insights = extractInsightsFromMessages(moderatorMessages);
  const debateMetrics = extractDebateMetrics(moderatorMessages);
  const debateData = formatDebateMetricsForPrompt(debateMetrics);
  const publicUrl = `${getAppBaseUrl()}/public/chat/${threadSlug}`;

  initializeOpenRouter(env);

  // Fetch admin tweet system prompt (custom instructions for tweet generation)
  const adminTweetPrompt = await getAdminSetting(db, 'tweetSystemPrompt');
  const dbSkillsPrompt = await getAdminSetting(db, 'tweetSkillsPrompt');
  const resolvedSkills = await resolveSkillTokens(dbSkillsPrompt, db);

  // Analyze past performance for context injection
  const perfInsights = await analyzePerformance(db);
  const performanceContext = formatPerformanceForTweetCraft(perfInsights);

  // Select tweet style (weighted by engagement performance)
  const selectedStyle = await selectTweetStyle(db);
  log.info(`[TweetCraft] Selected style "${selectedStyle.id}" for thread ${threadId}${perfInsights.hasEnoughData ? ` (perf: ${perfInsights.totalAnalyzed} tweets analyzed)` : ''}`);

  const systemPrompt = buildSystemPrompt(publicUrl, thread.title, insights, debateData, selectedStyle, trendContext, adminTweetPrompt || undefined, resolvedSkills, performanceContext || undefined);

  try {
    let tweet = '';
    let attempt = 0;

    while (attempt <= MAX_LENGTH_RETRIES) {
      const isRetry = attempt > 0;
      const prevLength = isRetry ? calculateTweetLength(tweet) : 0;

      const userText = isRetry
        ? `Your previous tweet was ${prevLength} characters — that's ${prevLength - MAX_TWEET_LENGTH} over the ${MAX_TWEET_LENGTH}-character limit. Rewrite it SHORTER. Cut filler words, shorten phrases, remove hashtags if needed. URLs count as ${TWEET_CHARACTER_RULES.tcoUrlLength} characters. Output ONLY the tweet text.`
        : 'Generate the tweet. Pick one copywriting framework, apply 2-3 psychology techniques, and follow all humanizer rules. Write like a real person, not a brand.';

      const result = await openRouterService.generateText({
        maxTokens: 1500,
        messages: [
          {
            id: `msg-tweet-craft-${attempt}`,
            parts: [{ text: userText, type: MessagePartTypes.TEXT }],
            role: UIMessageRoles.USER,
          },
        ],
        modelId: TWEET_CRAFT_MODEL_ID,
        system: systemPrompt,
        temperature: isRetry ? 0.7 : 0.9,
        traceContext: { distinctId: 'system', operation: 'tweet-craft', threadId },
      });

      tweet = result.text.trim().replace(/^["']|["']$/g, '');

      // Apply safety net: ensure URL is present and tweet fits within limits
      tweet = ensureTweetFitsWithUrl(tweet, publicUrl);
      const effectiveLength = calculateTweetLength(tweet);

      if (effectiveLength <= MAX_TWEET_LENGTH) {
        log.info(`[TweetCraft] Generated tweet for thread ${threadId} (${effectiveLength} chars, style: ${selectedStyle.id}${isRetry ? `, attempt ${attempt + 1}` : ''})`);
        return { style: selectedStyle.id, text: tweet };
      }

      log.warn(`[TweetCraft] Tweet too long (${effectiveLength}/${MAX_TWEET_LENGTH} chars), retrying (attempt ${attempt + 1}/${MAX_LENGTH_RETRIES})`);
      attempt++;
    }

    // All retries exhausted — apply aggressive trim as last resort
    const safeTweet = ensureTweetFitsWithUrl(tweet, publicUrl);
    const safeLength = calculateTweetLength(safeTweet);

    if (safeLength <= MAX_TWEET_LENGTH) {
      log.warn(`[TweetCraft] Used programmatic trim after ${MAX_LENGTH_RETRIES} retries (${safeLength} chars, style: ${selectedStyle.id})`);
      return { style: selectedStyle.id, text: safeTweet };
    }

    log.error(`[TweetCraft] Failed to fit tweet under ${MAX_TWEET_LENGTH} chars after ${MAX_LENGTH_RETRIES} retries + trim (final: ${safeLength} chars)`);
    throw createError.internal(
      `Generated tweet exceeds ${MAX_TWEET_LENGTH} characters after ${MAX_LENGTH_RETRIES} retries (${safeLength} chars)`,
      createTweetCraftErrorContext('craft_tweet'),
    );
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    log.error(`[TweetCraft] AI generation failed for thread ${threadId}: ${errMsg}`);

    throw createError.internal(
      `Tweet generation failed: ${errMsg}`,
      createTweetCraftErrorContext('craft_tweet'),
    );
  }
}
