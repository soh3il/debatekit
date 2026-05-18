/**
 * AI Devtools Provider - Dev-only debugging component
 *
 * Wraps @ai-sdk-tools/devtools for inspecting streaming state,
 * tool calls, and message flow during development.
 *
 * Tree-shaken from production builds.
 *
 * @module components/providers/ai-devtools-provider
 */

import { lazy, Suspense } from 'react';

const AIDevtools = lazy(() =>
  import('@ai-sdk-tools/devtools').then(mod => ({ default: mod.AIDevtools })),
);

const DEVTOOLS_CONFIG = {
  height: 400,
  position: 'bottom',
  throttle: {
    enabled: false,
    interval: 0,
  },
} as const;

const DEVTOOLS_STREAM_CAPTURE = {
  autoConnect: true,
  enabled: true,
  endpoints: ['/api/v1/chat/threads'] as string[],
};

export function AIDevtoolsProvider() {
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AIDevtools
        config={DEVTOOLS_CONFIG}
        debug
        enabled
        maxEvents={5000}
        streamCapture={DEVTOOLS_STREAM_CAPTURE}
      />
    </Suspense>
  );
}
