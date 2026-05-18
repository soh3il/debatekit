/**
 * Email Routes - Barrel Export
 *
 * Email preferences, unsubscribe flows, and tracking pixels.
 */

export {
  confirmResubscribeHandler,
  confirmUnsubscribeHandler,
  getPreferencesHandler,
  trackClickHandler,
  trackOpenHandler,
  updatePreferencesHandler,
  validateUnsubscribeHandler,
} from './handler';
export {
  confirmResubscribeRoute,
  confirmUnsubscribeRoute,
  getPreferencesRoute,
  trackClickRoute,
  trackOpenRoute,
  updatePreferencesRoute,
  validateUnsubscribeRoute,
} from './route';
