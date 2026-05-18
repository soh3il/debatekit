import { BRAND } from '@/constants';
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

type WelcomeProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function Welcome({
  sendLogId,
  unsubscribeUrl,
  userName,
}: WelcomeProps) {
  return (
    <EmailLayout>
      <EmailPreview text={`Welcome to ${BRAND.displayName} - your AI board of directors awaits`} />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Welcome to
            {' '}
            {BRAND.displayName}
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            Welcome to your AI board of directors. DebateKit brings together ChatGPT, Claude, Gemini, and Grok to debate your questions, challenge each other, and converge on better answers.
          </EmailText>

          <EmailText>
            You have
            {' '}
            <strong>5,000 free credits</strong>
            {' '}
            to get started. That is enough for dozens of brainstorming sessions.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=onboarding-welcome`}
              size="lg"
            >
              Start Your First Brainstorm
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

Welcome.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies WelcomeProps;
