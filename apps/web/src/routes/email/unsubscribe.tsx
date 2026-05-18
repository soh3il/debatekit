import { createFileRoute } from '@tanstack/react-router';
import z from 'zod';

import UnsubscribeScreen from '@/containers/screens/email/UnsubscribeScreen';
import { getAppBaseUrl } from '@/lib/config/base-urls';

const pageTitle = 'Unsubscribe - DebateKit';
const pageDescription = 'Manage your email subscription preferences for DebateKit.';

const unsubscribeSearchSchema = z.object({
  cat: z.string(),
  token: z.string(),
  uid: z.string(),
});

export const Route = createFileRoute('/email/unsubscribe')({
  validateSearch: unsubscribeSearchSchema,
  component: UnsubscribeScreen,
  head: () => {
    const siteUrl = getAppBaseUrl();
    return {
      links: [
        { href: `${siteUrl}/email/unsubscribe`, rel: 'canonical' },
      ],
      meta: [
        { title: pageTitle },
        { content: pageDescription, name: 'description' },
        // Open Graph
        { content: pageTitle, property: 'og:title' },
        { content: pageDescription, property: 'og:description' },
        { content: 'website', property: 'og:type' },
        { content: `${siteUrl}/email/unsubscribe`, property: 'og:url' },
        { content: `${siteUrl}/static/og-image.png`, property: 'og:image' },
        { content: 'DebateKit', property: 'og:site_name' },
        // Twitter
        { content: 'summary_large_image', name: 'twitter:card' },
        { content: '@debatekitnow', name: 'twitter:site' },
        { content: pageTitle, name: 'twitter:title' },
        { content: pageDescription, name: 'twitter:description' },
        { content: `${siteUrl}/static/og-image.png`, name: 'twitter:image' },
        // SEO - no index for unsubscribe pages
        { content: 'noindex, nofollow', name: 'robots' },
      ],
    };
  },
});
