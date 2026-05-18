import { ModelIds } from '@debatekit/shared';

import type { DEMO_SCENARIO_TABS } from './demo-scenarios';

// Re-export tabs so screens only need one import
export { DEMO_SCENARIO_TABS } from './demo-scenarios';

export type ChatDemoScenario = {
  promptText: string;
  userMessage: string;
  participants: readonly { modelId: string; role: string }[];
  responses: readonly string[];
  moderator: string;
};

export const CHAT_DEMO_SCENARIOS: Record<(typeof DEMO_SCENARIO_TABS)[number], ChatDemoScenario> = {
  Copywriting: {
    moderator: '**Consensus:** Kill "simple, transparent pricing" \u2014 it\u2019s commodity copy. 4/0 agreed. **A/B test two approaches:** specificity ("$99/mo, no surprises") vs objection-handling ("No penalties for growing"). **Critical dissent:** Grok\u2019s structural point is valid \u2014 audit tier layout in parallel. **Next steps:** (1) Remove commodity headline immediately, (2) run A/B test with the two strongest variants, (3) audit page structure as a separate workstream.',
    participants: [
      { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Conversion Copywriter' },
      { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Brand Voice' },
      { modelId: ModelIds.DEEPSEEK_DEEPSEEK_V3_2, role: 'Data-Driven Copy' },
      { modelId: ModelIds.X_AI_GROK_4, role: 'Contrarian' },
    ],
    promptText: 'Our pricing page headline is "Simple, transparent pricing" \u2014 conversion is 2.1% vs 3.4% industry avg. Rewrite?',
    responses: [
      'That headline is invisible \u2014 every SaaS says it. At 2.1% vs 3.4% avg, you\u2019re blending in. **Lead with the value gap: "Start building today. Scale when you\u2019re ready."**',
      'Agree, but go further. The headline should answer the objection, not describe the page. At a $29\u2192$99 jump, the fear is outgrowing Starter. **Address it directly: "No penalties for growing."**',
      'Both right that it\u2019s commodity copy. A/B test specificity: "$99/month, no surprises." **Specific numbers in headlines increase trust \u2014 and trust is the conversion bottleneck on pricing pages.**',
      'You\u2019re all optimizing copy when the page structure might be the problem. If the tiers aren\u2019t visually differentiated, no headline saves you. **Test the headline, but audit the tier layout in parallel. Copy can\u2019t fix a confusing page.**',
    ],
    userMessage: 'SaaS pricing page, 3 tiers ($29/$99/custom). Current headline: "Simple, transparent pricing." Conversion rate is 2.1% vs 3.4% industry average. Every competitor uses nearly identical headlines. Need the council to debate the rewrite strategy before we A/B test.',
  },
  Design: {
    moderator: '**Consensus:** Load more with date-group headers. 3/1 \u2014 infinite scroll optimizes for browsing, but this feed is for scanning. **Key agreement:** Date headers give position memory that infinite scroll destroys. **Critical dissent:** Grok\u2019s date picker idea works as a complement to load-more, not a justification for infinite scroll. **Next steps:** (1) Implement load-more with date-grouped sections, (2) add date-jump shortcut for deep history, (3) virtualize the rendered list for performance.',
    participants: [
      { modelId: ModelIds.OPENAI_GPT_4_1, role: 'UX Researcher' },
      { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Interaction Designer' },
      { modelId: ModelIds.X_AI_GROK_4, role: 'Performance Engineer' },
      { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Accessibility Lead' },
    ],
    promptText: 'Activity feed with 200 items/day \u2014 should we replace pagination with infinite scroll?',
    responses: [
      'Infinite scroll is wrong here. Activity feeds aren\u2019t entertainment \u2014 users need to relocate specific items. **Infinite scroll destroys position memory and makes "I saw something earlier" impossible. Keep pagination.**',
      'Neither. Use "load more" with date-group headers. Users get natural stopping points, position anchors from dates, and no jarring page transitions. **Infinite scroll solves for browsing \u2014 this is scanning.**',
      'Dissent \u2014 infinite scroll with virtualization. Users scan recent items 90% of the time. Pagination adds friction for the primary use case. **Virtualize to keep memory flat, add a date picker for finding old items.**',
      'Accessibility concern with infinite scroll: screen readers lose context, keyboard navigation breaks, and there\u2019s no reliable "end" for users to orient against. **Load-more with date headers preserves accessibility while modernizing the UX.**',
    ],
    userMessage: 'Activity feed redesign. ~200 items/day. Users scan for recent items and occasionally search older ones. Currently paginated (20/page). The design team wants to replace it with infinite scroll as the modern default. Engineering is skeptical. Need a council take.',
  },
  Engineering: {
    moderator: '**Consensus:** The council converges on a hybrid approach \u2014 modular monolith as the platform architecture, with the payment gateway extracted as an isolated service. **Key agreement:** All four models agree the full microservices migration is premature at current scale. **Critical insight from dissent:** Gemini\u2019s PCI compliance argument shifted the framing from a scaling question to a compliance-cost question. **Next steps:** (1) Define module boundaries immediately, (2) extract payment gateway as first isolated service, (3) revisit at 500K transactions/quarter.',
    participants: [
      { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Systems Architect' },
      { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Scalability Engineer' },
      { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Security Reviewer' },
      { modelId: ModelIds.X_AI_GROK_4, role: 'Pragmatist' },
    ],
    promptText: 'We\u2019re deciding between microservices and a modular monolith for our payment processing system. The team is split \u2014 need a council deliberation.',
    responses: [
      'At 200K transactions/month, a full microservices migration is premature. The operational cost \u2014 service mesh, distributed tracing, independent deployments \u2014 will consume more engineering hours than the scaling benefits justify. **Start with a modular monolith: define clear domain boundaries internally, extract the payment gateway as a standalone service only when transaction volume forces independent scaling.**',
      'Claude\u2019s right that full microservices are premature, but wrong to wait on the payment gateway. At 30% QoQ growth, you\u2019ll hit 500K transactions in 4 quarters. **Extract the payment processing pipeline now as a single isolated service. Keep everything else monolithic.**',
      'Both are debating scaling, but neither addresses the compliance surface. PCI DSS scope explodes with microservices \u2014 every service touching card data needs independent compliance. **A modular monolith with the payment gateway extracted as an isolated service reduces PCI audit scope to one service boundary instead of N.**',
      'Everyone\u2019s overthinking the architecture and underthinking the timeline. At your growth rate, you need the payment service extracted in Q1, not after a 6-month modularization project. **Ship the payment gateway extraction as a 4-week sprint. Use the modular monolith approach for everything else.**',
    ],
    userMessage: 'We\u2019re deciding between microservices and a modular monolith for our payment processing system. We handle 200K transactions/month, growing 30% QoQ. The team is split \u2014 half want microservices for independent scaling, half argue we\u2019re not at the scale to justify the operational overhead. Need a council deliberation.',
  },
  Marketing: {
    moderator: '**Consensus:** Lead with time savings on the homepage, ROI in sales decks. 3/1 agreed that headcount reduction reads as job elimination in enterprise procurement. **Critical insight from dissent:** Grok\u2019s point that different assets need different leads shifted the framing from "which number" to "which number where." **Next steps:** (1) Homepage: "Same team, 60% faster," (2) Sales deck: lead with 4x ROI, (3) Never lead with headcount reduction in outbound.',
    participants: [
      { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Conversion Specialist' },
      { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Brand Strategist' },
      { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Distribution Lead' },
      { modelId: ModelIds.X_AI_GROK_4, role: 'Sales Enablement' },
    ],
    promptText: 'Enterprise case study \u2014 should we lead with the 4x ROI number, the transformation narrative, or the headcount reduction?',
    responses: [
      'Lead with the team reduction \u2014 "12 people \u2192 4, same output." That\u2019s concrete and visceral. **ROI percentages are abstract; headcount is a budget line item every VP understands.**',
      'Don\u2019t lead with headcount. Enterprise buyers see "12\u21924 people" and think "this tool eliminates jobs." That triggers procurement fear, not excitement. **Lead with 60% time savings \u2014 same team, more capacity.**',
      'Agree with Claude \u2014 frame as ambition, not reduction. "Same team, 60% faster" is a story a VP shares up. **"8 people lost their workflow" is a story that stalls procurement.**',
      'For sales decks, lead with the 4x ROI \u2014 that\u2019s what the CFO signs off on. For the homepage, use the time savings. **Different asset, different lead. Don\u2019t use one number for both audiences.**',
    ],
    userMessage: 'Enterprise case study for a Fortune 500 customer. Results: 4x ROI, 60% time savings, team went from 12\u21924 people on the workflow. Deciding how to frame it: lead with ROI percentage, the transformation narrative, or the headcount reduction. This goes on the homepage and into sales decks.',
  },
  Product: {
    moderator: '**Consensus:** Build AI-assisted onboarding. 4/4 converged on a synthesis none proposed alone \u2014 use AI to solve the setup problem, validating the feature while fixing the funnel. **Key insight:** The AI assistant and onboarding aren\u2019t competing priorities; AI is the mechanism to fix onboarding. **Next steps:** (1) Build AI-powered setup wizard, (2) measure completion rate lift, (3) expand AI features based on validated demand.',
    participants: [
      { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Product Strategist' },
      { modelId: ModelIds.DEEPSEEK_DEEPSEEK_V3_2, role: 'Growth Analyst' },
      { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Pragmatist' },
      { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Data Analyst' },
    ],
    promptText: 'Top-voted feature is an AI assistant, but 23% of new accounts never complete setup. Which do we build first?',
    responses: [
      'The AI feature is a retention play for your best users. But 23% failing setup means you\u2019re losing ~78 accounts/year before they ever touch advanced features. **Fix the front door first \u2014 you can\u2019t retain users who never onboard.**',
      'Setup completion is a leading indicator. At 340 accounts, each lost account costs more than delighting existing ones. **The AI feature makes happy customers happier \u2014 setup fixes create actual customers.**',
      'Neither in isolation \u2014 build an AI-powered setup wizard. Auto-suggest workspace config using AI. **You fix the funnel and validate the AI feature with lower risk, in one initiative.**',
      'The data supports Claude\u2019s synthesis. Power users requesting AI aren\u2019t churning \u2014 the 23% who fail setup are. **Measure AI-assisted setup completion rate as your success metric. If it lifts onboarding, you\u2019ve validated both priorities.**',
    ],
    userMessage: 'B2B SaaS, 340 accounts. Top-voted feature request: AI assistant (89 votes, mostly power users). But 23% of new accounts never complete setup in the first week \u2014 no setup wizard exists. Team is debating: build the AI assistant to delight existing users, or fix the onboarding funnel first?',
  },
  Security: {
    moderator: '**Consensus:** Short-lived access tokens (15 min) + refresh token rotation. 4/0 \u2014 24h JWTs create an unrevocable attack window that fails both security and compliance review. **Critical insight:** DeepSeek\u2019s storage argument is upstream of the lifetime debate \u2014 httpOnly cookies for refresh, memory-only for access. **Next steps:** (1) Implement 15-min access + refresh rotation, (2) httpOnly cookie storage, (3) define a hard cutover date \u2014 no parallel auth systems.',
    participants: [
      { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Security Architect' },
      { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'AppSec Engineer' },
      { modelId: ModelIds.DEEPSEEK_DEEPSEEK_V3_2, role: 'Threat Modeler' },
      { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Compliance Lead' },
    ],
    promptText: 'Migrating from session cookies to JWT for our API. Team proposed 24-hour token expiry \u2014 is that safe?',
    responses: [
      '24-hour JWT is a 24-hour attack window. If a token leaks, you can\u2019t revoke it \u2014 JWTs are stateless by design. **Use short-lived access tokens (15 min) with refresh token rotation. You get the stateless benefit without the exposure.**',
      'Agree on short-lived tokens, but the bigger gap is the migration itself. Running sessions and JWTs in parallel doubles your attack surface during transition. **Define a cutover window \u2014 don\u2019t run both auth systems indefinitely.**',
      'Both miss the storage question. Where are tokens stored client-side? localStorage is XSS-vulnerable. **httpOnly cookies for the refresh token, memory-only for access tokens. The token lifetime debate is secondary to storage.**',
      'PII + 24h JWTs = compliance risk. If you\u2019re subject to SOC 2 or GDPR, auditors will flag the revocation gap. **Short-lived tokens with refresh rotation satisfies both security and compliance requirements.**',
    ],
    userMessage: 'Auth system for our B2B SaaS API. 2,000 active users, handles PII. Currently session-based cookies. Proposal: migrate to JWT with 24-hour expiry for mobile and third-party integrations. Security team is split on whether 24h tokens are acceptable.',
  },
  Strategy: {
    moderator: '**Consensus:** Buy commodity channels, own in-app. 3/1 initially favored full buy, but the hybrid synthesis is strongest. **Key agreement:** 3 sprints on notifications is unacceptable given the 8-week timeline. **Critical dissent:** Grok\u2019s distinction between infrastructure (buy) and product surface (build) reframed the debate. **Next steps:** (1) Integrate Novu for email/SMS/push, (2) build custom in-app notification layer, (3) ship both in sprint 1.',
    participants: [
      { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'CTO Advisor' },
      { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Engineering Lead' },
      { modelId: ModelIds.X_AI_GROK_4, role: 'Finance Analyst' },
      { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Product Strategist' },
    ],
    promptText: 'Need a notification system (email, SMS, push, in-app). Build it or buy? Team of 6, shipping v2 in 8 weeks.',
    responses: [
      'Buy. Your 6 engineers have 8 weeks to ship v2 \u2014 3 sprints on notifications is 40% of your runway. **Knock or Novu gets you multi-channel in days. Build only if notifications are your product \u2014 they\u2019re not.**',
      'Agree on buy, but Novu is open-source and self-hostable. At your scale, the managed service cost is fine. **But vendor lock-in on a core communication channel is a real risk. Start with Novu Cloud, keep the self-host exit option.**',
      'Dissent \u2014 build, but only the in-app layer. Email and SMS are commodity \u2014 use a provider. In-app notifications are UX-critical and change constantly. **Hybrid: buy commodity channels, build the one that touches your product.**',
      'Grok\u2019s hybrid is the right call. In-app notifications are a product surface, not infrastructure. **Vendor for email/SMS/push saves 2+ sprints. Custom in-app keeps control where users actually see it.**',
    ],
    userMessage: 'Notification system needed: email, SMS, push, and in-app. Team of 6 engineers, shipping v2 in 8 weeks. Build estimate is 3 sprints. Evaluating Knock, Novu, and a custom build. CEO wants in-house, engineering wants to buy. Need a tiebreaker.',
  },
};
