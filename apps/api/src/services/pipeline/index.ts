/**
 * Pipeline Services - Domain Barrel Export
 *
 * Automated content pipeline: trend discovery -> viral scoring -> job creation.
 */

export {
  autoDiscoverTrends,
  type AutoDiscoveryResult,
  discoverFromTwitterAPI,
} from './auto-discover.service';
export {
  runContentPipeline,
} from './content-pipeline.service';
export {
  analyzePerformance,
  formatPerformanceForDiscovery,
  formatPerformanceForTweetCraft,
  formatPerformanceForViralScoring,
  type PerformanceInsights,
} from './performance-analysis.service';
export {
  checkAndAutoTriggerPipeline,
  checkStalePipelineRuns,
} from './pipeline-cron.service';
export {
  scoreTweetVirality,
  type ViralScoreBreakdown,
  type ViralScoreResult,
} from './viral-scoring.service';
