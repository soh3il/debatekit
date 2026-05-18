import {
  EmailBody,
  EmailBrandFooter,
  EmailBrandHeader,
  EmailButton,
  EmailContainer,
  EmailDivider,
  EmailHeading,
  EmailHighlight,
  EmailLayout,
  EmailPreview,
  EmailSection,
  EmailText,
  UnsubscribeFooter,
} from '@/emails/components';
import { spacing } from '@/emails/design-tokens';
import { getAppBaseUrl } from '@/lib/config/base-urls';

type WhatYouLoseProps = {
  proExpiryDate?: string;
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function WhatYouLose({
  proExpiryDate = 'March 15, 2026',
  sendLogId,
  unsubscribeUrl,
  userName,
}: WhatYouLoseProps) {
  return (
    <EmailLayout>
      <EmailPreview text="Here's what changes when your Pro subscription ends" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            What Changes When Pro Ends
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            Your Pro subscription ends on
            {' '}
            <strong>{proExpiryDate}</strong>
            . After that, your account will revert to the free plan. Here is what changes:
          </EmailText>

          <EmailSection spacing="sm">
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight color="destructive">Unlimited credits</EmailHighlight>
              {' '}
              reverts to 5,000 credit cap
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight color="destructive">All models</EmailHighlight>
              {' '}
              reverts to limited model selection
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight color="destructive">Priority speed</EmailHighlight>
              {' '}
              reverts to standard response times
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight color="destructive">Custom personas</EmailHighlight>
              {' '}
              will no longer be available
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight color="destructive">Web search</EmailHighlight>
              {' '}
              will be disabled
            </EmailText>
          </EmailSection>

          <EmailText>
            Your threads and history will remain accessible on the free plan.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat/settings?utm_source=email&utm_medium=marketing&utm_campaign=churn-what-you-lose`}
              size="lg"
            >
              Keep Pro Active
            </EmailButton>
          </EmailSection>

          <EmailDivider />

          <EmailBrandFooter unsubscribeUrl={unsubscribeUrl} />

          <UnsubscribeFooter sendLogId={sendLogId} unsubscribeUrl={unsubscribeUrl} />
        </EmailContainer>
      </EmailBody>
    </EmailLayout>
  );
}

WhatYouLose.PreviewProps = {
  proExpiryDate: 'March 15, 2026',
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies WhatYouLoseProps;
