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

type WinbackProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function Winback({
  sendLogId,
  unsubscribeUrl,
  userName,
}: WinbackProps) {
  return (
    <EmailLayout>
      <EmailPreview text={`A lot has changed at ${BRAND.displayName} since you left`} />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            A Lot Has Changed
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            We have been busy making
            {' '}
            {BRAND.displayName}
            {' '}
            better since your last visit. Here is what is new:
          </EmailText>

          <EmailSection spacing="sm">
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>Faster responses</EmailHighlight>
              {' '}
              -- models debate and synthesize in seconds
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>New AI models</EmailHighlight>
              {' '}
              -- more perspectives at your debatekit
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <EmailHighlight>Improved synthesis</EmailHighlight>
              {' '}
              -- clearer, more actionable moderator summaries
            </EmailText>
          </EmailSection>

          <EmailText>
            Your account and all previous threads are exactly as you left them.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=retention-winback`}
              size="lg"
            >
              Come Back to DebateKit
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

Winback.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies WinbackProps;
