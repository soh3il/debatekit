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
import { getAppBaseUrl } from '@/lib/config/base-urls';

type CreditsLowProps = {
  creditPercentage?: number;
  creditsRemaining?: number;
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function CreditsLow({
  creditPercentage = 15,
  creditsRemaining = 750,
  sendLogId,
  unsubscribeUrl,
  userName,
}: CreditsLowProps) {
  return (
    <EmailLayout>
      <EmailPreview text={`You have ${creditsRemaining.toLocaleString()} credits remaining`} />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Your Credits Are Running Low
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            You have
            {' '}
            <EmailHighlight color="destructive">
              {creditsRemaining.toLocaleString()}
              {' '}
              credits
            </EmailHighlight>
            {' '}
            remaining -- that is just
            {' '}
            {creditPercentage}
            % of your free allocation. A few more brainstorming sessions and they will be gone.
          </EmailText>

          <EmailText>
            With Pro, you get unlimited credits so you never have to stop mid-thought. Plus all models, priority speed, and advanced features.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat/settings?utm_source=email&utm_medium=marketing&utm_campaign=conversion-credits-low`}
              size="lg"
            >
              Upgrade to Pro
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

CreditsLow.PreviewProps = {
  creditPercentage: 15,
  creditsRemaining: 750,
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies CreditsLowProps;
