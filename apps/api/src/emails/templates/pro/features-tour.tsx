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

type FeaturesTourProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function FeaturesTour({
  sendLogId,
  unsubscribeUrl,
  userName,
}: FeaturesTourProps) {
  return (
    <EmailLayout>
      <EmailPreview text="5 Pro features you should try today" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            5 Pro Features to Try Today
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            You have Pro -- make sure you are getting the most out of it. Here are five features worth trying:
          </EmailText>

          <EmailSection spacing="sm">
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>1. Custom model roles</EmailHighlight>
              {' '}
              -- assign each model a specific persona (skeptic, optimist, technical lead)
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>2. Web-grounded debates</EmailHighlight>
              {' '}
              -- enable web search so models cite real sources
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>3. Deep-dive rounds</EmailHighlight>
              {' '}
              -- ask follow-ups to drill into specific points from the debate
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>4. All models at once</EmailHighlight>
              {' '}
              -- add every available model for maximum perspective diversity
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>5. Thread history</EmailHighlight>
              {' '}
              -- revisit and continue any past brainstorm with full context
            </EmailText>
          </EmailSection>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=pro-features-tour`}
              size="lg"
            >
              Try Them Now
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

FeaturesTour.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies FeaturesTourProps;
