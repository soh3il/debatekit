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
import { getAppBaseUrl } from '@/lib/config/base-urls';

type SocialProofProps = {
  proUserCount?: number;
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function SocialProof({
  proUserCount = 1200,
  sendLogId,
  unsubscribeUrl,
  userName,
}: SocialProofProps) {
  return (
    <EmailLayout>
      <EmailPreview text={`See why ${proUserCount.toLocaleString()}+ users upgraded to Pro`} />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            See Why Others Upgraded
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            <strong>
              {proUserCount.toLocaleString()}
              + users
            </strong>
            {' '}
            have already upgraded to
            {' '}
            {BRAND.displayName}
            {' '}
            Pro. Here is what they say:
          </EmailText>

          <EmailText color="secondary" style={{ fontStyle: 'italic' }}>
            "Having multiple AI models debate a question gives me perspectives I never would have considered on my own."
          </EmailText>

          <EmailText color="secondary" style={{ fontStyle: 'italic' }}>
            "The moderator synthesis saves me hours of trying to reconcile different viewpoints."
          </EmailText>

          <EmailText>
            Join them and unlock the full power of multi-model brainstorming.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat/settings?utm_source=email&utm_medium=marketing&utm_campaign=conversion-social-proof`}
              size="lg"
            >
              Join Pro Users
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

SocialProof.PreviewProps = {
  proUserCount: 1200,
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies SocialProofProps;
