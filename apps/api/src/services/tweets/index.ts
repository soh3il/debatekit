/**
 * Twitter Services - Domain Barrel Export
 *
 * Handles tweet posting, deletion, crafting, scheduling, and skill-based
 * prompt generation via Twitter API v2 with OAuth 1.0a.
 */

export {
  collectTweetEngagement,
  getTopPerformingStyles,
} from './engagement-tracker.service';
export {
  craftTweetFromThread,
} from './tweet-craft.service';
export {
  processScheduledTweets,
  retryFailedTweets,
} from './tweet-cron.service';
export {
  DEFAULT_RUSH_HOUR_LABEL,
  getNextRushHourSlot,
  getUpcomingRushHourSlots,
  isRushHour,
  MAX_JITTER_MINUTES,
  RUSH_HOUR_LABEL_VALUES,
  RUSH_HOUR_WINDOWS,
  type RushHourLabel,
  RushHourLabels,
  RushHourLabelSchema,
  type RushHourWindow,
  RushHourWindowSchema,
  WINDOW_DURATION_HOURS,
} from './tweet-scheduler.service';
export {
  TWEET_CHARACTER_RULES,
} from './tweet-skills';
export {
  calculateTweetLength,
  createTwitterClient,
  deleteTweet,
  getTwitterConfig,
  postTweet,
  type TwitterApiConfig,
  TwitterApiConfigSchema,
} from './twitter-api.service';
export {
  analyzeTopTweetPatterns,
  type EngagementPatterns,
  getTrendingTopics,
  searchRecentTweets,
  type TrendingTopic,
  type TweetSearchResult,
} from './twitter-trends.service';
