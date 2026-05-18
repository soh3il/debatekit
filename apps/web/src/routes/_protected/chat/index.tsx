import { createFileRoute } from '@tanstack/react-router';

import ChatOverviewScreen from '@/containers/screens/chat/ChatOverviewScreen';
import { getServerQuickStartData } from '@/lib/config';
import { getAppBaseUrl } from '@/lib/config/base-urls';

const pageTitle = 'Chat - DebateKit';
const pageDescription = 'Start a new AI conversation with multiple models.';

export const Route = createFileRoute('/_protected/chat/')({
  component: ChatOverviewScreen,
  loader: () => getServerQuickStartData(),
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
        { property: 'og:url', content: `${siteUrl}/chat` },
        { property: 'og:site_name', content: 'DebateKit' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:site', content: '@debatekitnow' },
        { name: 'twitter:title', content: pageTitle },
        { name: 'twitter:description', content: pageDescription },
      ],
      links: [
        { rel: 'canonical', href: `${siteUrl}/chat` },
      ],
    };
  },
});
