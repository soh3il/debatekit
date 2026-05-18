import { createFileRoute } from '@tanstack/react-router';

import { BillingSuccessClient } from '@/containers/screens/chat/billing/BillingSuccessClient';
import { requireNonAnonymous } from '@/lib/auth';
import { getAppBaseUrl } from '@/lib/config/base-urls';

const pageTitle = 'Subscription Successful - DebateKit';
const pageDescription = 'Your subscription has been activated. Welcome to DebateKit!';

export const Route = createFileRoute('/_protected/chat/billing/subscription-success')({
  ssr: false,
  component: BillingSuccessClient,
  beforeLoad: ({ context }) => {
    requireNonAnonymous(context.session);
  },
  head: () => {
    const siteUrl = getAppBaseUrl();
    return {
      meta: [
        { title: pageTitle },
        { name: 'description', content: pageDescription },
        { name: 'robots', content: 'noindex, nofollow' },
        { property: 'og:title', content: pageTitle },
        { property: 'og:description', content: pageDescription },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: `${siteUrl}/chat/billing/subscription-success` },
        { property: 'og:site_name', content: 'DebateKit' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:site', content: '@debatekitnow' },
        { name: 'twitter:title', content: pageTitle },
        { name: 'twitter:description', content: pageDescription },
      ],
      links: [
        { rel: 'canonical', href: `${siteUrl}/chat/billing/subscription-success` },
      ],
    };
  },
});
