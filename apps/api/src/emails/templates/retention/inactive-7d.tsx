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

type Inactive7dProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function Inactive7d({
  sendLogId,
  unsubscribeUrl,
  userName,
}: Inactive7dProps) {
  return (
    <EmailLayout>
      <EmailPreview text="Your AI advisors are waiting for your next question" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Your AI Advisors Are Waiting
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            It has been a week since your last session. Your board of AI advisors is ready to tackle whatever is on your mind -- product decisions, technical challenges, strategic questions, or creative brainstorms.
          </EmailText>

          <EmailText>
            Start a new thread and let multiple AI models debate the best path forward.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=retention-7d`}
              size="lg"
            >
              Start a New Brainstorm
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

Inactive7d.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies Inactive7dProps;
