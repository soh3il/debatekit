import {
  EmailBody,
  EmailBrandFooter,
  EmailBrandHeader,
  EmailButton,
  EmailContainer,
  EmailDivider,
  EmailHeading,
  EmailLayout,
  EmailPreview,
  EmailSection,
  EmailText,
  UnsubscribeFooter,
} from '@/emails/components';
import { getAppBaseUrl } from '@/lib/config/base-urls';

type FeatureLimitProps = {
  limitHitCount?: number;
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function FeatureLimit({
  limitHitCount = 5,
  sendLogId,
  unsubscribeUrl,
  userName,
}: FeatureLimitProps) {
  return (
    <EmailLayout>
      <EmailPreview text="Stop hitting limits -- remove them all with Pro" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Stop Hitting Limits
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            You have hit free plan limits
            {' '}
            <strong>
              {limitHitCount}
              {' '}
              times
            </strong>
            {' '}
            recently. That means you are actively trying to do things that Pro unlocks.
          </EmailText>

          <EmailText>
            With Pro, there are no limits on models, sessions, credits, or features. Just open brainstorming with every AI model available.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat/settings?utm_source=email&utm_medium=marketing&utm_campaign=conversion-feature-limit`}
              size="lg"
            >
              Remove All Limits
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

FeatureLimit.PreviewProps = {
  limitHitCount: 5,
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies FeatureLimitProps;
