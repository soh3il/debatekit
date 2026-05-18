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

type WinbackOfferProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function WinbackOffer({
  sendLogId,
  unsubscribeUrl,
  userName,
}: WinbackOfferProps) {
  return (
    <EmailLayout>
      <EmailPreview text="Come back to DebateKit Pro -- special offer inside" />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            We Want You Back
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            We miss having you as a Pro member. Since you left, we have continued improving
            {' '}
            {BRAND.displayName}
            {' '}
            with faster models, better synthesis, and new features.
          </EmailText>

          <EmailText>
            We would love to welcome you back. Reactivate your Pro subscription and pick up right where you left off -- all your threads and history are intact.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat/settings?utm_source=email&utm_medium=marketing&utm_campaign=churn-winback-offer`}
              size="lg"
            >
              Reactivate Pro
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

WinbackOffer.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies WinbackOfferProps;
