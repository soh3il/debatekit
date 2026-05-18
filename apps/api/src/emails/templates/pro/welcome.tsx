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

type ProWelcomeProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function ProWelcome({
  sendLogId,
  unsubscribeUrl,
  userName,
}: ProWelcomeProps) {
  return (
    <EmailLayout>
      <EmailPreview text={`Welcome to ${BRAND.displayName} Pro -- all limits removed`} />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Welcome to Pro
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            Thank you for upgrading. All limits have been removed from your account. Here is what you now have access to:
          </EmailText>

          <EmailSection spacing="sm">
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>Unlimited credits</EmailHighlight>
              {' '}
              -- brainstorm as much as you want
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>All AI models</EmailHighlight>
              {' '}
              -- every model at your debatekit
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>Priority speed</EmailHighlight>
              {' '}
              -- faster responses across all models
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>Custom personas</EmailHighlight>
              {' '}
              -- assign roles to each model
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>Web search</EmailHighlight>
              {' '}
              -- ground debates in real-time data
            </EmailText>
          </EmailSection>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=pro-welcome`}
              size="lg"
            >
              Explore Pro Features
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

ProWelcome.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies ProWelcomeProps;
