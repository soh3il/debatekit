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
  moderator: `**Consensus:** The council unanimously recommends against a full microservices migration on a 6-month runway. **Key agreement:** Start with a modular monolith \u2014 define domain boundaries, establish team ownership, and fix CI/CD independently. **Critical insight from Grok:** Conway\u2019s Law means organizational boundaries must precede architectural boundaries. **Dissent noted:** GPT-4.1 argues 2-3 high-scaling domains should be extracted early; Gemini insists auth boundary comes first. **Actionable plan:** (1) Define domain ownership model, (2) Fix CI/CD pipeline to <10min deploys, (3) Modularize auth boundary first, (4) Extract only scaling-critical domains as services.`,
  participants: [
    { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Systems Architect' },
    { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Performance Engineer' },
    { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Security Reviewer' },
    { modelId: ModelIds.X_AI_GROK_4, role: 'Pragmatist' },
  ],
  promptText: 'We need to break up our Rails monolith. The team is split between microservices and a modular monolith. What\u2019s the right call for a 40-person eng team?',
  responses: [
    `With 40 engineers and a 6-month runway, microservices are the wrong move. The operational overhead alone \u2014 service mesh, distributed tracing, contract testing, deployment orchestration \u2014 will consume your runway. **Start with a modular monolith: extract domain boundaries within the monolith first, then lift bounded contexts into services only when you have the platform team to support them.**`,
    `Claude's right on the timeline, but wrong on the endgame. Your 45-minute deploy is a CI/CD problem, not an architecture problem \u2014 parallelized test suites and incremental builds cut that to 8 minutes without touching the architecture. **The real question: which 2-3 domains have independent scaling needs? Extract those first. Keep everything else monolithic.**`,
    `Both proposals underestimate the security surface area change. Moving to microservices means service-to-service auth, network policies, secret rotation across N services, and N independent attack surfaces instead of one. **If you modularize, invest in the auth boundary first \u2014 a shared auth module that becomes a service later. Don\u2019t scatter auth logic across domain boundaries.**`,
    `Here\u2019s what nobody\u2019s saying: your problem isn\u2019t the monolith, it\u2019s team coupling. Conway\u2019s Law says your architecture will mirror your org structure. **Fix the ownership model first. Define clear domain boundaries and team ownership in the monolith before you extract anything. Every failed microservices migration I\u2019ve seen started by splitting code before splitting ownership.**`,
  ],
  userMessage: 'Our Rails monolith is 500K lines, deploy takes 45 minutes, and teams step on each other daily. Leadership wants microservices. Some senior engineers argue for a modular monolith. We have 40 engineers, 8 teams, and a 6-month runway before the next funding round. What\u2019s the right architecture call?',
};

export function ArchitectureHeroDemo() {
  return <HeroDemoBase data={DATA} />;
}
