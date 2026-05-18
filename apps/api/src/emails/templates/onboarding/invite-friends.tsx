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

type InviteFriendsProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function InviteFriends({
  sendLogId,
  unsubscribeUrl,
  userName,
}: InviteFriendsProps) {
  return (
    <EmailLayout>
      <EmailPreview text="Your brainstorms are worth sharing" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Your Brainstorms Are Worth Sharing
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            The best ideas come from collaboration. Share
            {' '}
            {BRAND.displayName}
            {' '}
            with your team and see what happens when multiple AI models debate your most important questions together.
          </EmailText>

          <EmailText>
            Whether it is product decisions, technical architecture, or strategic planning, multi-model brainstorming gives your team a new superpower.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=onboarding-invite`}
              size="lg"
            >
              Share DebateKit
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

InviteFriends.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies InviteFriendsProps;
