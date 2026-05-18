import { ModelIds } from '@debatekit/shared';

import type { HeroDemoData } from './hero-demo-base';
import { HeroDemoBase } from './hero-demo-base';

const DATA: HeroDemoData = {
  composerModels: [
    ModelIds.ANTHROPIC_CLAUDE_SONNET_4,
    ModelIds.OPENAI_GPT_4_1,
    ModelIds.GOOGLE_GEMINI_2_5_PRO,
    ModelIds.X_AI_GROK_4,
  ],
  moderator: `**Consensus:** The council converges on a hybrid approach \u2014 modular monolith as the platform architecture, with the payment gateway extracted as an isolated service. This isn't a compromise; it's the strongest position that emerged from the debate. **Key agreement:** All four models agree the full microservices migration is premature at current scale. **Critical insight from dissent:** Gemini's PCI compliance argument shifted the framing from a scaling question to a compliance-cost question \u2014 the payment service extraction pays for itself in reduced audit scope. **Actionable next steps:** (1) Define module boundaries in the monolith immediately, (2) extract payment gateway as first isolated service, (3) revisit extraction of additional services when quarterly transaction volume exceeds 500K.`,
  participants: [
    { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Systems Architect' },
    { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Scalability Engineer' },
    { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Security Reviewer' },
    { modelId: ModelIds.X_AI_GROK_4, role: 'Pragmatist' },
  ],
  promptText: 'We\'re deciding between microservices and a modular monolith for our payment processing system. The team is split \u2014 need a council deliberation.',
  responses: [
    `At 50K transactions/day with a team of 12, a modular monolith is the right call. You get deployment independence through module boundaries without the operational overhead of distributed systems. **The key: define strict module interfaces now \u2014 payment processing, merchant management, reporting \u2014 so extraction to services is mechanical when you genuinely need it.** Your deploy time problem is a CI/CD problem, not an architecture problem.`,
    `I'll push back on Claude's framing. 40% quarterly growth means you'll hit 200K transactions/day within a year. At that point, the payment processing hot path needs independent scaling \u2014 you can't scale the entire monolith for one module's load. **Start with a modular monolith for everything except the payment gateway itself. Extract that as a dedicated service now**, while the team has bandwidth, rather than under production pressure later.`,
    `Both proposals miss the PCI compliance angle. With a monolith \u2014 modular or not \u2014 your entire codebase is in PCI scope. **Extract the payment gateway into an isolated service with its own network boundary, and your PCI audit surface drops by 80%.** This isn't about scaling preferences, it's about compliance cost. Every module that touches card data increases your audit scope, and that's a $200K+ annual cost difference.`,
    `Gemini's point changes the calculus entirely. Here's the pragmatic path: **Modular monolith for the platform, isolated payment service for PCI scope reduction.** You get Claude's simplicity for 90% of the codebase, GPT's scaling independence for the hot path, and Gemini's compliance boundary. Don't let the microservices-vs-monolith framing blind you \u2014 the answer is surgical extraction, not wholesale migration.`,
  ],
  userMessage: 'Our payment processing system handles 50K transactions/day and is growing 40% quarterly. The current monolith is getting painful \u2014 deploys take 45 minutes, the team of 12 engineers steps on each other constantly, and PCI compliance scope is the entire codebase. We\'re debating microservices vs modular monolith. Engineering is split down the middle. What does the council think?',
};

export function LlmCouncilHeroDemo() {
  return <HeroDemoBase data={DATA} />;
}
