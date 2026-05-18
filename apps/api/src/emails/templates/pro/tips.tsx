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

type ProTipsProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function ProTips({
  sendLogId,
  unsubscribeUrl,
  userName,
}: ProTipsProps) {
  return (
    <EmailLayout>
      <EmailPreview text="Pro tip: make AI models disagree on purpose" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Pro Tip: Make Models Disagree
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            Here is something most Pro users discover: the best brainstorming sessions are the ones where models
            {' '}
            <strong>disagree</strong>
            .
          </EmailText>

          <EmailText>
            Try giving models opposing roles. Make one the advocate and another the critic. The tension between viewpoints is where the best insights emerge.
          </EmailText>

          <EmailText>
            For example, ask about a business strategy and assign one model as "aggressive growth advocate" and another as "risk-averse CFO." The moderator will synthesize both perspectives into a balanced recommendation.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=pro-tips`}
              size="lg"
            >
              Start a Debate
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

ProTips.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies ProTipsProps;
