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

type PowerTipsProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function PowerTips({
  sendLogId,
  unsubscribeUrl,
  userName,
}: PowerTipsProps) {
  return (
    <EmailLayout>
      <EmailPreview text="3 DebateKit features most people miss" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            3 Features Most People Miss
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            You are already using DebateKit, but there are a few features that unlock the real power of multi-model brainstorming.
          </EmailText>

          <EmailSection spacing="sm">
            <EmailText weight="semibold" style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>1. Custom roles</EmailHighlight>
            </EmailText>
            <EmailText color="secondary">
              Give AI models specific personas. Make Claude your skeptic, GPT your optimist, and Gemini your data analyst. Different perspectives lead to richer debates.
            </EmailText>
          </EmailSection>

          <EmailSection spacing="sm">
            <EmailText weight="semibold" style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>2. Web search</EmailHighlight>
            </EmailText>
            <EmailText color="secondary">
              Let models research the web before responding. They will ground their arguments in real data instead of relying only on training knowledge.
            </EmailText>
          </EmailSection>

          <EmailSection spacing="sm">
            <EmailText weight="semibold" style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>3. Multiple rounds</EmailHighlight>
            </EmailText>
            <EmailText color="secondary">
              Ask follow-up questions to go deeper. Each round builds on the previous debate, refining the group's thinking over time.
            </EmailText>
          </EmailSection>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=onboarding-power-tips`}
              size="lg"
            >
              Try These Features
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

PowerTips.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies PowerTipsProps;
