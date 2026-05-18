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

type Inactive30dProps = {
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function Inactive30d({
  sendLogId,
  unsubscribeUrl,
  userName,
}: Inactive30dProps) {
  return (
    <EmailLayout>
      <EmailPreview text={`We'll keep your threads safe -- and a lot has changed at ${BRAND.displayName}`} />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            We Will Keep Your Threads Safe
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            It has been a while since your last visit. No worries -- all of your brainstorming threads are safely stored and waiting for you.
          </EmailText>

          <EmailText>
            A lot has changed since you were last here. We have been shipping new features, improving model performance, and making the brainstorming experience even better.
          </EmailText>

          <EmailText>
            Come see what is new and pick up right where you left off.
          </EmailText>

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=retention-30d`}
              size="lg"
            >
              See What's New
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

Inactive30d.PreviewProps = {
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies Inactive30dProps;
