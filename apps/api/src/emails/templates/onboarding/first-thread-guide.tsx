import { BRAND } from '@/constants';
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

type FirstThreadGuideProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function FirstThreadGuide({
  sendLogId,
  unsubscribeUrl,
  userName,
}: FirstThreadGuideProps) {
  return (
    <EmailLayout>
      <EmailPreview text="3 steps to your first AI brainstorm on DebateKit" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            3 Steps to Your First AI Brainstorm
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            Getting started with
            {' '}
            {BRAND.displayName}
            {' '}
            takes less than a minute. Here is how:
          </EmailText>

          <EmailSection spacing="sm">
            <EmailText weight="semibold" style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>Step 1:</EmailHighlight>
              {' '}
              Choose your topic
            </EmailText>
            <EmailText color="secondary">
              Ask any question, from business strategy to technical architecture. The more specific, the better the debate.
            </EmailText>
          </EmailSection>

          <EmailSection spacing="sm">
            <EmailText weight="semibold" style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>Step 2:</EmailHighlight>
              {' '}
              Select AI models
            </EmailText>
            <EmailText color="secondary">
              Pick which AI models sit at your debatekit. They will debate each other, challenge assumptions, and offer unique perspectives.
            </EmailText>
          </EmailSection>

          <EmailSection spacing="sm">
            <EmailText weight="semibold" style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>Step 3:</EmailHighlight>
              {' '}
              Review the synthesis
            </EmailText>
            <EmailText color="secondary">
              A moderator distills the debate into clear, actionable insights. You get the best thinking from every model.
            </EmailText>
          </EmailSection>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=onboarding-first-thread`}
              size="lg"
            >
              Create Your First Thread
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

FirstThreadGuide.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies FirstThreadGuideProps;
