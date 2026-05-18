/**
 * Podcast Components - Lazy-loaded barrel exports
 *
 * All podcast components are lazy-loaded since they're only needed
 * when podcast features are accessed.
 */

import dynamic from '@/lib/utils/dynamic';

// Lazy-loaded components
export const ThreadModeratorPlayer = dynamic(
  () => import('./dynamic-island-player').then(m => ({ default: m.ThreadModeratorPlayer })),
  { ssr: false },
);

export const PodcastHeaderButton = dynamic<{ disabled?: boolean; threadId: string }>(
  () => import('./podcast-header-button').then(m => ({ default: m.PodcastHeaderButton })),
  { ssr: false },
);

export const PublicPodcastListenButton = dynamic<{ slug: string; threadId: string }>(
  () => import('./public-podcast-listen-button').then(m => ({ default: m.PublicPodcastListenButton })),
);
