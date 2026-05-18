import { Img } from '@react-email/components';

import { getApiBaseUrl } from '@/lib/config/base-urls';

type EmailTrackingPixelProps = {
  sendLogId?: string;
};

const apiBaseUrl = getApiBaseUrl();

/**
 * Invisible 1x1 tracking pixel for email open tracking.
 * Points to /email/track/open/{logId} which returns a transparent GIF
 * and records the open event in the send_log + PostHog.
 *
 * Only renders when sendLogId is provided (queue consumer injects it).
 */
export function EmailTrackingPixel({ sendLogId }: EmailTrackingPixelProps) {
  if (!sendLogId) {
    return null;
  }

  return (
    <Img
      alt=""
      height="1"
      src={`${apiBaseUrl}/email/track/open/${sendLogId}`}
      style={{ border: 0, display: 'block', height: '1px', outline: 'none', width: '1px' }}
      width="1"
    />
  );
}
