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
import { colors, spacing } from '@/emails/design-tokens';
import { getAppBaseUrl } from '@/lib/config/base-urls';

type ProTeaserProps = {
  currentModelLimit?: number;
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

const checkStyle = { color: colors.primary, fontWeight: '600' as const };
const crossStyle = { color: colors.mutedForeground };

export function ProTeaser({
  currentModelLimit = 3,
  sendLogId,
  unsubscribeUrl,
  userName,
}: ProTeaserProps) {
  return (
    <EmailLayout>
      <EmailPreview text={`You've been using ${BRAND.displayName} with training wheels`} />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Unlock the Full DebateKit
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            You have been using
            {' '}
            {BRAND.displayName}
            {' '}
            on the free plan, which limits you to
            {' '}
            {currentModelLimit}
            {' '}
            models per session. Here is what you are missing:
          </EmailText>

          <EmailSection spacing="sm">
            <EmailText weight="semibold" style={{ marginBottom: spacing[2] }}>
              Free Plan
            </EmailText>
            <EmailText color="secondary" style={{ marginBottom: spacing[1] }}>
              <span style={crossStyle}>-</span>
              {' '}
              Limited models per session
            </EmailText>
            <EmailText color="secondary" style={{ marginBottom: spacing[1] }}>
              <span style={crossStyle}>-</span>
              {' '}
              5,000 credits
            </EmailText>
            <EmailText color="secondary" style={{ marginBottom: spacing[1] }}>
              <span style={crossStyle}>-</span>
              {' '}
              Standard response speed
            </EmailText>
          </EmailSection>

          <EmailSection spacing="sm">
            <EmailText weight="semibold" style={{ marginBottom: spacing[2] }}>
              Pro Plan
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <span style={checkStyle}>+</span>
              {' '}
              All models, unlimited sessions
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <span style={checkStyle}>+</span>
              {' '}
              Unlimited credits
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <span style={checkStyle}>+</span>
              {' '}
              Priority response speed
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <span style={checkStyle}>+</span>
              {' '}
              Custom model roles and personas
            </EmailText>
            <EmailText style={{ marginBottom: spacing[1] }}>
              <span style={checkStyle}>+</span>
              {' '}
              Web search for grounded answers
            </EmailText>
          </EmailSection>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat/settings?utm_source=email&utm_medium=marketing&utm_campaign=onboarding-pro-teaser`}
              size="lg"
            >
              See Pro Features
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

ProTeaser.PreviewProps = {
  currentModelLimit: 3,
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies ProTeaserProps;
