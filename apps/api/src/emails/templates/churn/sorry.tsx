import { BRAND } from '@/constants';
import {
  EmailBody,
  EmailBrandFooter,
  EmailBrandHeader,
  EmailContainer,
  EmailDivider,
  EmailHeading,
  EmailLayout,
  EmailPreview,
  EmailText,
  UnsubscribeFooter,
} from '@/emails/components';

type SorryProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

export function Sorry({
  sendLogId,
  unsubscribeUrl,
  userName,
}: SorryProps) {
  return (
    <EmailLayout>
      <EmailPreview text="We're sorry to see you go" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            We Are Sorry to See You Go
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            We are sorry that
            {' '}
            {BRAND.displayName}
            {' '}
            Pro was not the right fit. Your subscription has been cancelled, and you will not be charged again.
          </EmailText>

          <EmailText>
            Your account will remain active on the free plan. All your existing threads and brainstorming history are preserved -- you can revisit them anytime.
          </EmailText>

          <EmailText>
            If there is anything we could have done differently, we would love to hear from you. Just reply to this email.
          </EmailText>

          <EmailDivider />

          <EmailBrandFooter unsubscribeUrl={unsubscribeUrl} />

          <UnsubscribeFooter sendLogId={sendLogId} unsubscribeUrl={unsubscribeUrl} />
        </EmailContainer>
      </EmailBody>
    </EmailLayout>
  );
}

Sorry.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies SorryProps;
