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

type CreditsDepletedProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function CreditsDepleted({
  sendLogId,
  unsubscribeUrl,
  userName,
}: CreditsDepletedProps) {
  return (
    <EmailLayout>
      <EmailPreview text="Your free credits have run out -- upgrade to keep brainstorming" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Your Credits Have Run Out
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            Your 5,000 free credits are used up. To continue using DebateKit and get access to unlimited AI brainstorming sessions, upgrade to Pro.
          </EmailText>

          <EmailText>
            Pro gives you unlimited credits, all AI models, priority response speed, and advanced features like custom personas and web search.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat/settings?utm_source=email&utm_medium=marketing&utm_campaign=conversion-credits-depleted`}
              size="lg"
            >
              Get Unlimited Credits with Pro
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

CreditsDepleted.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies CreditsDepletedProps;
