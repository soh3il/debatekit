import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { SubscriptionChangedClient } from '@/containers/screens/chat/billing/SubscriptionChangedClient';
import { requireNonAnonymous } from '@/lib/auth';
import { getAppBaseUrl } from '@/lib/config/base-urls';

const pageTitle = 'Subscription Updated - DebateKit';
const pageDescription = 'Your subscription has been updated successfully.';

const subscriptionChangedSearchSchema = z.object({
  changeType: z.string().optional(),
  newProductId: z.string().optional(),
  oldProductId: z.string().optional(),
});

export const Route = createFileRoute('/_protected/chat/billing/subscription-changed')({
  validateSearch: subscriptionChangedSearchSchema,
  component: SubscriptionChangedClient,
  ssr: false,
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
        { property: 'og:url', content: `${siteUrl}/chat/billing/subscription-changed` },
        { property: 'og:site_name', content: 'DebateKit' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:site', content: '@debatekitnow' },
        { name: 'twitter:title', content: pageTitle },
        { name: 'twitter:description', content: pageDescription },
      ],
      links: [
        { rel: 'canonical', href: `${siteUrl}/chat/billing/subscription-changed` },
      ],
    };
  },
});
