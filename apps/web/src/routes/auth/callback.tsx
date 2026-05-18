import { createFileRoute, redirect } from '@tanstack/react-router';

import { getAppBaseUrl } from '@/lib/config/base-urls';

const pageTitle = 'Signing In - DebateKit';
const pageDescription = 'Completing authentication...';

export const Route = createFileRoute('/auth/callback')({
  beforeLoad: () => {
    throw redirect({ to: '/chat' });
  },
  component: () => null,
  head: () => {
    const siteUrl = getAppBaseUrl();
    return {
      meta: [
        { title: pageTitle },
        { content: pageDescription, name: 'description' },
        { content: 'noindex, nofollow', name: 'robots' },
        { content: pageTitle, property: 'og:title' },
        { content: pageDescription, property: 'og:description' },
        { content: 'website', property: 'og:type' },
        { content: `${siteUrl}/auth/callback`, property: 'og:url' },
        { content: 'DebateKit', property: 'og:site_name' },
        { content: 'summary', name: 'twitter:card' },
        { content: '@debatekitnow', name: 'twitter:site' },
        { content: pageTitle, name: 'twitter:title' },
        { content: pageDescription, name: 'twitter:description' },
      ],
    };
  },
});
