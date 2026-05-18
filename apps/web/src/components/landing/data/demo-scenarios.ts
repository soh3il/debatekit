import type { DemoScenario } from '../mcp-terminal-demo';

export const DEMO_SCENARIO_TABS = ['Engineering', 'Product', 'Marketing', 'Design', 'Copywriting', 'Security', 'Strategy'] as const;

export const DEMO_SCENARIOS: Record<(typeof DEMO_SCENARIO_TABS)[number], DemoScenario> = {
  Copywriting: {
    agentContinue: 'Great call on the specificity angle. Scrapping the commodity headline \u2014 A/B testing the two strongest approaches.',
    agentWorking: 'I\'ll write the pricing page headline \u2014 going with \'Simple, transparent pricing.\'',
    contextBriefing: 'SaaS pricing page, 3 tiers ($29/$99/custom). Current headline: \'Simple, transparent pricing.\' Conversion: 2.1% vs 3.4% industry avg. Every competitor uses similar headlines.',
    models: [
      { color: 'text-emerald-400', label: 'Claude Sonnet (Conversion)', text: 'That headline is invisible \u2014 every SaaS says it. At 2.1% vs 3.4% avg, you\'re blending in. Lead with the value gap: \'Start building today. Scale when you\'re ready.\'' },
      { color: 'text-blue-400', label: 'GPT-4.1 (Copywriter)', text: 'Agree, but go further. The headline should answer the objection, not describe the page. At a $29\u2192$99 jump, the fear is outgrowing Starter. Address it: \'No penalties for growing.\'' },
      { color: 'text-violet-400', label: 'DeepSeek R1 (Data)', text: 'Both right that it\'s commodity copy. A/B test specificity: \'$99/month, no surprises.\' Specific numbers in headlines increase trust \u2014 and trust is the conversion bottleneck on pricing pages.' },
    ],
    userInvoke: 'debate this before we ship it',
    verdict: 'Kill \'simple, transparent pricing\' \u2014 it\'s commodity copy. 3/0 agreed. A/B test specificity (\'$99/mo, no surprises\') vs objection-handling (\'No penalties for growing\').',
  },
  Design: {
    agentContinue: 'Switching to load-more with date-grouped headers. Adding a date jump shortcut from the dissent \u2014 good call.',
    agentWorking: 'I\'ll implement infinite scroll for the activity feed \u2014 it\'s the modern default.',
    contextBriefing: 'Activity feed, ~200 items/day. Users scan for recent items and occasionally search older ones. Currently paginated (20/page). Proposal: replace with infinite scroll.',
    models: [
      { color: 'text-emerald-400', label: 'GPT-4.1 (UX Researcher)', text: 'Infinite scroll is wrong here. Activity feeds aren\'t entertainment \u2014 users need to relocate specific items. Infinite scroll destroys position memory and makes \'I saw something earlier\' impossible. Keep pagination.' },
      { color: 'text-blue-400', label: 'Gemini 2.5 Pro (Interaction)', text: 'Neither. Use \'load more\' with date-group headers. Users get natural stopping points, position anchors from dates, and no jarring page transitions. Infinite scroll solves for browsing \u2014 this is scanning.' },
      { color: 'text-violet-400', label: 'Grok (Performance)', text: 'Dissent \u2014 infinite scroll with virtualization. Users scan recent items 90% of the time. Pagination adds friction for the primary use case. Virtualize to keep memory flat, add a date picker for finding old items.' },
    ],
    userInvoke: 'wait \u2014 let the council weigh in',
    verdict: 'Load more with date headers. 2/1 \u2014 infinite scroll optimizes for browsing, but this feed is for scanning. Date headers give position memory. The dissent\'s date picker idea works as a complement.',
  },
  Engineering: {
    agentContinue: 'Solid debate. Starting with query profiling on the 3 slow endpoints. If it\'s schema-level, we\'ll revisit the Redis path.',
    agentWorking: 'I\'ll add a Redis caching layer \u2014 p95 latency is at 380ms and climbing.',
    contextBriefing: 'API p95 latency 380ms, target 200ms. 14 endpoints, 3 are slow. Postgres on RDS, no caching layer. Considering Redis vs query optimization.',
    models: [
      { color: 'text-emerald-400', label: 'GPT-4.1 (Architect)', text: 'Profile the 3 slow endpoints first. 380ms p95 usually means one or two bad queries, not a systemic problem. Adding Redis to mask an optimization gap creates operational complexity you don\'t need.' },
      { color: 'text-blue-400', label: 'Gemini 2.5 Pro (SRE)', text: 'Agree \u2014 profile first. Redis adds a new failure mode. If it goes down, your cold-start latency is worse than today. Optimize queries, then cache only what still needs it.' },
      { color: 'text-violet-400', label: 'Grok (Performance)', text: 'Dissent \u2014 add Redis now with a 60s TTL on the 3 slow endpoints. Query optimization assumes the queries are fixable. If it\'s a schema issue, you won\'t know until you profile, and profiling takes a sprint you may not have.' },
    ],
    userInvoke: 'hold on, let\'s debate this first',
    verdict: 'Profile first, cache second. 2/1 \u2014 but the dissent matters: if profiling reveals schema issues, Redis becomes the right bridge while you plan the migration.',
  },
  Marketing: {
    agentContinue: 'Glad we caught that. Reframing around the 60% time savings \u2014 headcount moves to a supporting data point, not the headline.',
    agentWorking: 'I\'ll lead the case study with the 4x ROI number \u2014 it\'s our strongest proof point.',
    contextBriefing: 'Enterprise case study, Fortune 500 customer. Results: 4x ROI, 60% time savings, team went from 12\u21924 people on the workflow. Deciding: lead with ROI vs transformation narrative vs headcount reduction.',
    models: [
      { color: 'text-emerald-400', label: 'GPT-4.1 (Conversion)', text: 'Lead with the team reduction \u2014 \'12 people \u2192 4, same output.\' That\'s concrete and visceral. ROI percentages are abstract; headcount is a budget line item every VP understands.' },
      { color: 'text-blue-400', label: 'Claude Sonnet (Brand)', text: 'Don\'t lead with headcount. Enterprise buyers see \'12\u21924 people\' and think \'this tool eliminates jobs.\' That triggers procurement fear, not excitement. Lead with 60% time savings \u2014 same team, more capacity.' },
      { color: 'text-violet-400', label: 'Gemini 2.5 Pro (Distribution)', text: 'Agree with Claude \u2014 frame as ambition, not reduction. \'Same team, 60% faster\' is a story a VP shares up. \'8 people lost their workflow\' is a story that stalls procurement.' },
    ],
    userInvoke: 'get the council\'s take on this',
    verdict: 'Lead with time savings, not headcount. 2/1 \u2014 the dissent caught a landmine: \'12\u21924 people\' reads as job elimination in enterprise procurement. Frame as \'same team, 60% faster.\'',
  },
  Product: {
    agentContinue: 'That synthesis is sharp. Scoping an AI-powered setup wizard that validates demand for the assistant while fixing the 23% drop-off.',
    agentWorking: 'I\'ll spec out the AI assistant feature \u2014 it\'s the top-voted item on the roadmap.',
    contextBriefing: 'B2B SaaS, 340 accounts. Top-voted: AI assistant (89 votes, mostly power users). Silent signal: 23% of new accounts never complete setup in first week. No setup wizard exists.',
    models: [
      { color: 'text-emerald-400', label: 'GPT-4.1 (Product Strategist)', text: 'The AI feature is a retention play for your best users. But 23% failing setup means you\'re losing ~78 accounts/year before they ever touch advanced features. Fix the front door first.' },
      { color: 'text-blue-400', label: 'DeepSeek R1 (Growth)', text: 'Setup completion is a leading indicator. At 340 accounts, each lost account costs more than delighting existing ones. The AI feature makes happy customers happier \u2014 setup fixes create actual customers.' },
      { color: 'text-violet-400', label: 'Claude Sonnet (Pragmatist)', text: 'Neither in isolation \u2014 build an AI-powered setup wizard. Auto-suggest workspace config using AI. You fix the funnel and validate the AI feature with lower risk, in one initiative.' },
    ],
    userInvoke: 'actually, put this into a debate',
    verdict: 'Build AI-assisted setup. 3/3 converged on a synthesis none proposed alone \u2014 use AI to solve the setup problem, validating the feature while fixing the funnel.',
  },
  Security: {
    agentContinue: 'Good catch on the storage vector. Implementing 15-min access tokens with httpOnly refresh cookies and a clean cutover plan.',
    agentWorking: 'I\'ll add JWT authentication with a 24-hour token expiry \u2014 standard approach for the API.',
    contextBriefing: 'Auth system for B2B SaaS API. 2,000 active users, handles PII. Currently session-based cookies. Proposal: migrate to JWT with 24h expiry for mobile and third-party integrations.',
    models: [
      { color: 'text-emerald-400', label: 'GPT-4.1 (Security Architect)', text: '24-hour JWT is a 24-hour attack window. If a token leaks, you can\'t revoke it \u2014 JWTs are stateless by design. Use short-lived access tokens (15 min) with refresh token rotation. You get the stateless benefit without the exposure.' },
      { color: 'text-blue-400', label: 'Claude Sonnet (AppSec)', text: 'Agree on short-lived tokens, but the bigger gap is the migration itself. Running sessions and JWTs in parallel doubles your attack surface during transition. Define a cutover window \u2014 don\'t run both auth systems indefinitely.' },
      { color: 'text-violet-400', label: 'DeepSeek R1 (Threat Model)', text: 'Both miss the storage question. Where are tokens stored client-side? localStorage is XSS-vulnerable. httpOnly cookies for the refresh token, memory-only for access tokens. The token lifetime debate is secondary to storage.' },
    ],
    userInvoke: 'let\'s get the council\'s take first',
    verdict: 'Short-lived access tokens (15 min) + refresh rotation. 3/0 \u2014 24h JWTs create an unrevocable attack window. Critical add: httpOnly cookie storage, not localStorage.',
  },
  Strategy: {
    agentContinue: 'Smart split. Integrating Novu for email/SMS/push, building a lightweight in-app notification system in-house.',
    agentWorking: 'I\'ll draft a build plan for the notification system \u2014 estimated 3 sprints.',
    contextBriefing: 'Notification system needed: email, SMS, push, in-app. Team of 6 engineers, shipping v2 in 8 weeks. Build estimate: 3 sprints. Evaluating Knock, Novu, and custom build.',
    models: [
      { color: 'text-emerald-400', label: 'Gemini 2.5 Pro (CTO)', text: 'Buy. Your 6 engineers have 8 weeks to ship v2 \u2014 3 sprints on notifications is 40% of your runway. Knock or Novu gets you multi-channel in days. Build only if notifications are your product \u2014 they\'re not.' },
      { color: 'text-blue-400', label: 'GPT-4.1 (Eng Lead)', text: 'Agree on buy, but Novu is open-source and self-hostable. At your scale, the managed service cost is fine. But vendor lock-in on a core communication channel is a real risk. Start with Novu Cloud, keep the self-host exit option.' },
      { color: 'text-violet-400', label: 'Grok (Finance)', text: 'Dissent \u2014 build, but only the in-app layer. Email and SMS are commodity \u2014 use a provider. In-app notifications are UX-critical and change constantly. Hybrid: buy commodity channels, build the one that touches your product.' },
    ],
    userInvoke: 'hold on, debate build vs buy first',
    verdict: 'Buy commodity channels, own in-app. 2/1 \u2014 but the hybrid synthesis is strongest: vendor for email/SMS/push, custom for in-app. Saves 2+ sprints while keeping control where it matters.',
  },
};
