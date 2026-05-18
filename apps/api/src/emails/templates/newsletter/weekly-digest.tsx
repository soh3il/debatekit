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
  EmailLink,
  EmailPreview,
  EmailSection,
  EmailText,
  UnsubscribeFooter,
} from '@/emails/components';
import { spacing } from '@/emails/design-tokens';
import { getAppBaseUrl } from '@/lib/config/base-urls';

type DigestItem = {
  title: string;
  summary: string;
  url: string;
};

type WeeklyDigestProps = {
  digestItems?: DigestItem[];
  newFeatures?: string[];
  sendLogId?: string;
  userName?: string;
  unsubscribeUrl: string;
};

const webappUrl = getAppBaseUrl();

export function WeeklyDigest({
  digestItems = [],
  newFeatures = [],
  sendLogId,
  unsubscribeUrl,
  userName,
}: WeeklyDigestProps) {
  return (
    <EmailLayout>
      <EmailPreview text={`Your Weekly ${BRAND.displayName} Digest`} />
      <EmailBody>
        <EmailContainer>
          <EmailBrandHeader />

          <EmailHeading level={2}>
            Your Weekly Digest
          </EmailHeading>

          <EmailText>
            {userName ? `Hi ${userName},` : 'Hi there,'}
          </EmailText>

          <EmailText>
            Here is what happened on
            {' '}
            {BRAND.displayName}
            {' '}
            this week.
          </EmailText>

          {digestItems.length > 0 && (
            <>
              <EmailSection spacing="sm">
                <EmailText weight="semibold" style={{ marginBottom: spacing[2] }}>
                  Trending Threads
                </EmailText>
                {digestItems.map((item, index) => (
                  <EmailSection key={index} spacing="sm" style={{ marginBottom: spacing[3] }}>
                    <EmailText weight="medium" style={{ marginBottom: spacing[1] }}>
                      <EmailLink href={`${item.url}?utm_source=email&utm_medium=marketing&utm_campaign=newsletter-weekly-digest`}>
                        {item.title}
                      </EmailLink>
                    </EmailText>
                    <EmailText color="secondary" size="sm">
                      {item.summary}
                    </EmailText>
                  </EmailSection>
                ))}
              </EmailSection>

              <EmailDivider />
            </>
          )}

          {newFeatures.length > 0 && (
            <EmailSection spacing="sm">
              <EmailText weight="semibold" style={{ marginBottom: spacing[2] }}>
                What's New
              </EmailText>
              {newFeatures.map((feature, index) => (
                <EmailText key={index} style={{ marginBottom: spacing[1] }}>
                  <EmailHighlight>New:</EmailHighlight>
                  {' '}
                  {feature}
                </EmailText>
              ))}
            </EmailSection>
          )}

          <EmailSection align="center">
            <EmailButton
              href={`${webappUrl}/chat?utm_source=email&utm_medium=marketing&utm_campaign=newsletter-weekly-digest`}
              size="lg"
            >
              Start a New Brainstorm
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

WeeklyDigest.PreviewProps = {
  digestItems: [
    {
      summary: 'AI models debated the merits of microservices vs monoliths for a growing startup.',
      title: 'Microservices vs Monolith for Series A Startups',
      url: 'https://example.com/thread/1',
    },
    {
      summary: 'A debatekit on the best approaches to marketing a developer tool.',
      title: 'How to Market a Developer Tool in 2026',
      url: 'https://example.com/thread/2',
    },
    {
      summary: 'Models explored optimal pricing strategies for SaaS products.',
      title: 'SaaS Pricing Strategy Deep Dive',
      url: 'https://example.com/thread/3',
    },
  ],
  newFeatures: [
    'Faster model response times across all providers',
    'Improved moderator synthesis quality',
    'New model: Grok 3 is now available',
  ],
  unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  userName: 'Alex Morgan',
} satisfies WeeklyDigestProps;
