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

type Inactive14dProps = {
  lastThreadTitle?: string;
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function Inactive14d({
  lastThreadTitle,
  sendLogId,
  unsubscribeUrl,
  userName,
}: Inactive14dProps) {
  return (
    <EmailLayout>
      <EmailPreview text="Your threads are still here, ready when you are" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Your Threads Are Still Here
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          {lastThreadTitle
            ? (
                <EmailText>
                  Your last brainstorm --
                  {' '}
                  <strong>{lastThreadTitle}</strong>
                  {' '}
                  -- is still waiting for you. Pick up where you left off, or start something new.
                </EmailText>
              )
            : (
                <EmailText>
                  All of your previous brainstorming sessions are saved and ready for you to revisit. Pick up where you left off, or start a fresh thread.
                </EmailText>
              )}

          <EmailText>
            Your AI advisors do not forget context. Follow-up questions in existing threads build on everything discussed before.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=retention-14d`}
              size="lg"
            >
              Continue Where You Left Off
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

Inactive14d.PreviewProps = {
  lastThreadTitle: 'Should we pivot to enterprise?',
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies Inactive14dProps;
