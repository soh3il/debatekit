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

type CreditsReminderProps = {
  creditPercentage?: number;
  creditsRemaining?: number;
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function CreditsReminder({
  creditPercentage = 40,
  creditsRemaining = 2000,
  sendLogId,
  unsubscribeUrl,
  userName,
}: CreditsReminderProps) {
  return (
    <EmailLayout>
      <EmailPreview text="Your free credits won't last forever" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Your Credits Are Going Fast
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            You have
            {' '}
            <EmailHighlight>
              {creditsRemaining.toLocaleString()}
              {' '}
              credits
            </EmailHighlight>
            {' '}
            remaining (
            {creditPercentage}
            % of your free allocation). At your current pace, they will run out soon.
          </EmailText>

          <EmailText>
            Upgrade to Pro for unlimited credits and never worry about running out mid-brainstorm again.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat/settings?utm_source=email&utm_medium=marketing&utm_campaign=onboarding-credits-reminder`}
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

CreditsReminder.PreviewProps = {
  creditPercentage: 40,
  creditsRemaining: 2000,
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies CreditsReminderProps;
