/**
 * Email Services - Domain Barrel Export
 *
 * Single source of truth for all email-related API services
 * Matches backend route structure: /api/v1/email/*
 */

export {
  type ConfirmResubscribeRequest,
  type ConfirmResubscribeResponse,
  confirmResubscribeService,
  type ConfirmUnsubscribeRequest,
  type ConfirmUnsubscribeResponse,
  confirmUnsubscribeService,
  type GetEmailPreferencesRequest,
  type GetEmailPreferencesResponse,
  getEmailPreferencesService,
  type UpdateEmailPreferencesRequest,
  type UpdateEmailPreferencesResponse,
  updateEmailPreferencesService,
  type ValidateUnsubscribeRequest,
  type ValidateUnsubscribeResponse,
  validateUnsubscribeService,
} from './email-preferences';
