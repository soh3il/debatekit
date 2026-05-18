/**
 * Hono API Worker Entry Point
 *
 * Pure Cloudflare Workers backend for the DebateKit API.
 * Handles all API routes, auth, and background tasks via:
 * - Hono API routes
 * - Durable Objects for scheduling
 * - Queue handlers for async tasks
 *
 * IMPORTANT: Uses lazy loading to reduce worker startup CPU time.
 * The full app is loaded on first request, not at module initialization.
 */

import type { MessageBatch } from '@cloudflare/workers-types';

// Type-only import for AppType (no runtime cost)
export type { AppType } from './src/index';

// Durable Object classes - lightweight exports with no heavy dependencies at worker startup
// Note: This is a valid re-export pattern for worker.ts as it's the Cloudflare Workers entry point
// that must export DO classes. The alternative would be inline class definitions here, which
// would reduce modularity. This re-export is acceptable as worker.ts serves as the deployment
// boundary/entry point, not a barrel export.
export { UploadCleanupScheduler } from './src/workers/upload-cleanup-scheduler';

// Lazy-loaded app cache
let _rootApp: RootApp | null = null;

type HonoFetch = (request: Request, env: CloudflareEnv, ctx: ExecutionContext) => Response | Promise<Response>;
type RootApp = { fetch: HonoFetch };

async function getRootApp(): Promise<RootApp> {
  if (!_rootApp) {
    // Dynamic import - not evaluated at worker startup!
    const module = await import('./src/index');
    _rootApp = module.default;
  }
  // _rootApp is guaranteed non-null after the if-guard above
  const app = _rootApp;
  if (!app) {
    throw new Error('Failed to load root app');
  }
  return app;
}

// Export the main worker handler with queue support
// Track worker cold start time
const workerStartTime = Date.now();
let workerInitialized = false;

export default {
  /**
   * HTTP request handler.
   * Lazily loads the full app on first request.
   */
  async fetch(
    request: Request,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const requestStartTime = Date.now();
    const url = new URL(request.url);

    // Quick health check without loading the full app - with timing metrics
    if (url.pathname === '/health' || url.pathname === '/api/v1/health') {
      const isFirstRequest = !workerInitialized;
      workerInitialized = true;

      const timings = {
        workerAgeMs: requestStartTime - workerStartTime,
        requestProcessingMs: Date.now() - requestStartTime,
        isColdStart: isFirstRequest,
      };

      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'debatekit-api',
        timings,
        env: env.WEBAPP_ENV || 'unknown',
      }), {
        headers: {
          'Content-Type': 'application/json',
          'X-Worker-Age-Ms': String(timings.workerAgeMs),
          'X-Request-Processing-Ms': String(timings.requestProcessingMs),
          'X-Cold-Start': String(isFirstRequest),
        },
      });
    }

    // Load full app for all other routes
    const appLoadStart = Date.now();
    const rootApp = await getRootApp();
    const appLoadMs = Date.now() - appLoadStart;

    // Add timing header to response
    const response = await rootApp.fetch(request, env, ctx);
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-App-Load-Ms', String(appLoadMs));
    newHeaders.set('X-Total-Ms', String(Date.now() - requestStartTime));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },

  /**
   * Queue handler for Cloudflare Queues.
   * Uses dynamic imports to avoid loading heavy modules at startup.
   */
  async queue(
    batch: MessageBatch,
    env: CloudflareEnv,
  ): Promise<void> {
    // Title generation queue
    if (batch.queue.startsWith('title-generation-queue')) {
      const { handleTitleGenerationQueue } = await import('./src/workers/title-generation-queue');
      type TitleMsg = import('./src/types/queues').TitleGenerationQueueMessage;
      return await handleTitleGenerationQueue(batch as MessageBatch<TitleMsg>, env);
    }

    // Round orchestration queue
    if (batch.queue.startsWith('round-orchestration-queue')) {
      const { handleRoundOrchestrationQueue } = await import('./src/workers/round-orchestration-queue');
      type RoundMsg = import('./src/types/queues').RoundOrchestrationQueueMessage;
      return await handleRoundOrchestrationQueue(batch as MessageBatch<RoundMsg>, env);
    }

    // Podcast generation queue
    if (batch.queue.startsWith('podcast-generation-queue')) {
      const { handlePodcastGenerationQueue } = await import('./src/workers/podcast-generation-queue');
      type PodcastMsg = import('./src/types/queues').PodcastGenerationQueueMessage;
      return await handlePodcastGenerationQueue(batch as MessageBatch<PodcastMsg>, env);
    }

    // Tweet posting queue
    if (batch.queue.startsWith('tweet-posting-queue')) {
      const { handleTweetPostingQueue } = await import('./src/workers/tweet-posting-queue');
      type TweetMsg = import('./src/types/queues').TweetPostingQueueMessage;
      return await handleTweetPostingQueue(batch as MessageBatch<TweetMsg>, env);
    }

    // Email sending queue
    if (batch.queue.startsWith('email-sending-queue')) {
      const { handleEmailSendingQueue } = await import('./src/workers/email-sending-queue');
      type EmailMsg = import('./src/types/queues').EmailSendingQueueMessage;
      return await handleEmailSendingQueue(batch as MessageBatch<EmailMsg>, env);
    }
  },

  /**
   * Scheduled (cron) handler for periodic tasks.
   *
   * Cron schedules (configured in wrangler.jsonc):
   * - Every 5 min: Post due scheduled tweets, mark stale jobs, check pipeline completion
   * - Every 12 hours: Run content pipeline, collect tweet engagement metrics
   * - Daily 3 AM UTC: Clean up expired anonymous users
   */
  async scheduled(
    controller: ScheduledController,
    env: CloudflareEnv,
  ): Promise<void> {
    let db: Awaited<ReturnType<typeof import('./src/db').getDbAsync>>;
    try {
      const { getDbAsync } = await import('./src/db');
      db = await getDbAsync();
    } catch (err) {
      // CRITICAL: Without this try/catch, a transient D1 failure silently kills
      // ALL cron tasks for this schedule with no error logging.
      try {
        const { log } = await import('./src/lib/logger');
        log.error(`[Cron] CRITICAL: Database initialization failed for ${controller.cron}: ${err instanceof Error ? err.message : String(err)}`);
      } catch {
        // Even logging failed — nothing we can do
      }
      return;
    }

    // ---- Every 5 minutes: tweet posting + stale job/pipeline checks ----
    if (controller.cron === '*/5 * * * *') {
      // Task 1a: Re-queue failed tweets that still have retries remaining
      try {
        const { retryFailedTweets } = await import('./src/services/tweets');
        await retryFailedTweets(db, env);
      } catch (err) {
        const { log } = await import('./src/lib/logger');
        log.error(`[Cron] retryFailedTweets failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Task 1b: Auto-post scheduled tweets whose scheduledAt has passed
      try {
        const { processScheduledTweets } = await import('./src/services/tweets');
        await processScheduledTweets(db, env);
      } catch (err) {
        const { log } = await import('./src/lib/logger');
        log.error(`[Cron] processScheduledTweets failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Task 2: Mark stale automated jobs as failed (2+ hours inactive)
      try {
        const { markStaleJobsAsFailed } = await import('./src/services/jobs');
        await markStaleJobsAsFailed(db);
      } catch (err) {
        const { log } = await import('./src/lib/logger');
        log.error(`[Cron] markStaleJobsAsFailed failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Task 3: Transition pipeline runs based on job completion
      try {
        const { checkStalePipelineRuns } = await import('./src/services/pipeline');
        await checkStalePipelineRuns(db, env);
      } catch (err) {
        const { log } = await import('./src/lib/logger');
        log.error(`[Cron] checkStalePipelineRuns failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      return;
    }

    // ---- Every 12 hours: run content pipeline + collect tweet engagement ----
    if (controller.cron === '0 */12 * * *') {
      // Task 1: Collect engagement metrics for recent tweets
      try {
        const { collectTweetEngagement } = await import('./src/services/tweets');
        await collectTweetEngagement(db, env);
      } catch (err) {
        const { log } = await import('./src/lib/logger');
        log.error(`[Cron] collectTweetEngagement failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Task 2: Trigger content pipeline (respects admin toggle + active run check)
      try {
        const { checkAndAutoTriggerPipeline } = await import('./src/services/pipeline');
        await checkAndAutoTriggerPipeline(db, env);
      } catch (err) {
        const { log } = await import('./src/lib/logger');
        log.error(`[Cron] checkAndAutoTriggerPipeline failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Task 3: Run email drip campaigns (onboarding, retention, conversion)
      try {
        const { runScheduledEmailCampaigns } = await import('./src/services/email');
        await runScheduledEmailCampaigns(db, env);
      } catch (err) {
        const { log } = await import('./src/lib/logger');
        log.error(`[Cron] runScheduledEmailCampaigns failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      return;
    }

    // ---- Daily 3 AM UTC: cleanup tasks ----
    if (controller.cron === '0 3 * * *') {
      const { eq, lt, and } = await import('drizzle-orm');
      const tables = await import('./src/db/tables');
      const { invalidateAllUserCaches } = await import('./src/common/cache-utils');

      // Clean expired email suppressions (soft bounces)
      try {
        const { cleanExpiredSuppressions } = await import('./src/services/email');
        await cleanExpiredSuppressions(db);
      } catch (err) {
        const { log } = await import('./src/lib/logger');
        log.error(`[Cron] cleanExpiredSuppressions failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Clean up expired anonymous users (30+ days old)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const CLEANUP_BATCH_LIMIT = 500;
      const expiredAnonymousUsers = await db
        .select()
        .from(tables.user)
        .where(
          and(
            eq(tables.user.isAnonymous, true),
            lt(tables.user.createdAt, thirtyDaysAgo),
          ),
        )
        .limit(CLEANUP_BATCH_LIMIT)
        .all();

      if (expiredAnonymousUsers.length > 0) {
        const { executeBatch } = await import('./src/common/batch-operations');
        for (const u of expiredAnonymousUsers) {
          await invalidateAllUserCaches(db, u.id);
        }

        const BATCH_CHUNK_SIZE = 100;
        for (let i = 0; i < expiredAnonymousUsers.length; i += BATCH_CHUNK_SIZE) {
          const chunk = expiredAnonymousUsers.slice(i, i + BATCH_CHUNK_SIZE);
          await executeBatch(db, chunk.map(u =>
            db.delete(tables.user).where(eq(tables.user.id, u.id)),
          ));
        }
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
