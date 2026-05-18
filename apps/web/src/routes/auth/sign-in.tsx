import { createFileRoute, redirect } from '@tanstack/react-router';
import z from 'zod';

import { AuthForm } from '@/components/auth/auth-form';
import { AuthShowcaseLayout } from '@/components/auth/auth-showcase-layout';
import { getAppBaseUrl } from '@/lib/config/base-urls';

const pageTitle = 'Sign In - DebateKit';
const pageDescription = 'Sign in to DebateKit - the collaborative AI brainstorming platform where multiple AI models work together to solve problems and generate ideas.';

// Validate search params (redirect for post-auth navigation, toast/message for user feedback)
const signInSearchSchema = z.object({
  action: z.string().optional(),
  from: z.string().optional(),
  message: z.string().optional(),
  redirect: z.string().optional(),
  toast: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_medium: z.string().optional(),
  // UTM tracking params (passthrough)
  utm_source: z.string().optional(),
});

export const Route = createFileRoute('/auth/sign-in')({
  // ✅ ISR: Static shell - cache for 1h at CDN, serve stale for 24h
  // beforeLoad runs server-side so redirects work, but HTML shell is cacheable
  validateSearch: signInSearchSchema,
  component: SignInPage,
  // Use session from root context - NO duplicate API call
  beforeLoad: async ({ context, search }) => {
    const { session } = context;

    // Allow anonymous users through so they can sign up for a real account.
    // Only redirect fully-authenticated (non-anonymous) users back.
    // Use the redirect param if present (e.g., from MCP authorize flow).
    if (session && !session.user.isAnonymous) {
      throw redirect({ to: search.redirect || '/chat' });
    }
  },
  head: () => {
    const siteUrl = getAppBaseUrl();
    return {
      meta: [
        { title: pageTitle },
        { name: 'description', content: pageDescription },
        // Open Graph
        { property: 'og:title', content: pageTitle },
        { property: 'og:description', content: pageDescription },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: `${siteUrl}/auth/sign-in` },
        { property: 'og:image', content: `${siteUrl}/static/og-image.png` },
        { property: 'og:site_name', content: 'DebateKit' },
        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@debatekitnow' },
        { name: 'twitter:title', content: pageTitle },
        { name: 'twitter:description', content: pageDescription },
        { name: 'twitter:image', content: `${siteUrl}/static/og-image.png` },
        // SEO
        { name: 'robots', content: 'index, follow' },
      ],
      links: [
        { rel: 'canonical', href: `${siteUrl}/auth/sign-in` },
      ],
    };
  },
  headers: () => ({
    'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  }),
});

function SignInPage() {
  // Session is guaranteed NOT to exist by beforeLoad
  // If user logs in, they'll be redirected on next navigation
  return (
    <AuthShowcaseLayout>
      <AuthForm />
    </AuthShowcaseLayout>
  );
}
