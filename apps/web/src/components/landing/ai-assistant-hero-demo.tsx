import { useMemo } from 'react';

import type { ChatDemoScenario } from './data/chat-demo-scenarios';
import type { HeroDemoData } from './hero-demo-base';
import { HeroDemoBase } from './hero-demo-base';

export function AiAssistantHeroDemo({ scenario }: { scenario: ChatDemoScenario }) {
  const data = useMemo<HeroDemoData>(() => ({
    composerModels: scenario.participants.map(p => p.modelId),
    moderator: scenario.moderator,
    participants: scenario.participants,
    promptText: scenario.promptText,
    responses: scenario.responses,
    userMessage: scenario.userMessage,
  }), [scenario]);

  return <HeroDemoBase data={data} />;
}
