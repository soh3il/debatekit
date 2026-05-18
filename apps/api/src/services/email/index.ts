/**
 * Email Services - Barrel Export
 *
 * Centralized email lifecycle management: preferences, suppression,
 * sending, tracking, campaigns, and template rendering.
 */

export {
  checkFrequencyCap,
  getCampaignCohort,
  getCampaignConfig,
  getConversionCohort,
  getOnboardingCohort,
  getRetentionCohort,
  runScheduledEmailCampaigns,
  triggerWeeklyNewsletter,
} from './email-campaign.service';
export {
  buildUnsubscribeUrl,
  createDefaultPreferences,
  generateUnsubscribeToken,
  getUserPreferences,
  isUserSubscribed,
  setGlobalUnsubscribe,
  updatePreference,
  validateUnsubscribeToken,
} from './email-preference.service';
export {
  enqueueEmail,
  updateSendLogStatus,
} from './email-sending.service';
export {
  addToSuppressionList,
  cleanExpiredSuppressions,
  isEmailSuppressed,
  removeFromSuppressionList,
} from './email-suppression.service';
export {
  getTemplateRenderer,
  hasTemplate,
  registerTemplate,
} from './email-template-registry';
export {
  trackEmailBounce,
  trackEmailClick,
  trackEmailComplaint,
  trackEmailDelivery,
  trackEmailOpen,
} from './email-tracking.service';
export {
  registerMarketingTemplates,
} from './register-marketing-templates';
