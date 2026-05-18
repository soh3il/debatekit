import { Provider as AiSdkStoreProvider } from '@ai-sdk-tools/store';
import type { ReactNode } from 'react';

import { AIDevtoolsProvider } from './ai-devtools-provider';
import { ChatStoreProvider } from './chat-store-provider';

type ChatLayoutProvidersProps = {
  children: ReactNode;
};

/**
 * Chat Layout Providers
 *
 * Wraps chat routes with AiSdkStoreProvider (required by @ai-sdk-tools/store's
 * useChat) and ChatStoreProvider (DebateKit-specific Zustand state).
 * Separated from root AppProviders to avoid heavy initialization
 * on non-chat routes (auth, public, static pages).
 */
export function ChatLayoutProviders({ children }: ChatLayoutProvidersProps) {
  return (
    <AiSdkStoreProvider>
      <ChatStoreProvider>
        {children}
        <AIDevtoolsProvider />
      </ChatStoreProvider>
    </AiSdkStoreProvider>
  );
}
