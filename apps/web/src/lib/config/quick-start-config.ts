import type { ChatMode, ModelId } from '@debatekit/shared';
import { ChatModes, ModelIds } from '@debatekit/shared';

import type { ModelPresetId } from '@/lib/config/model-presets';

export type PromptTemplate = {
  title: string;
  prompt: string;
  mode: ChatMode;
  roles: string[];
  preferredModelIds?: ModelId[];
  presetId?: ModelPresetId;
};

export const PROMPT_POOL: PromptTemplate[] = [
  // CEO/Executive
  {
    mode: ChatModes.DEBATING,
    preferredModelIds: [ModelIds.OPENAI_GPT_5_1, ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    prompt: 'We\'re a $4M ARR B2B SaaS (project management, 40 employees). Our main competitor just got acquired by Microsoft for $200M. We have 18 months runway and 15% MoM growth. Seek acquisition while market is hot, raise Series A to compete, or stay bootstrapped and niche down?',
    roles: ['Strategic Advisor', 'Growth Strategist', 'Devil\'s Advocate', 'M&A Expert'],
    title: 'Our competitor got acquired. Seek a buyer or raise to compete?',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.OPENAI_GPT_5, ModelIds.GOOGLE_GEMINI_3_1_PRO_PREVIEW, ModelIds.DEEPSEEK_DEEPSEEK_V3_2],
    prompt: 'We\'re a $6M ARR fintech startup, profitable at $400K/year but growth dropped from 8% to 3% MoM. We have $2M in the bank, 50 employees. Cut 20% of staff to extend runway to 3 years, or spend reserves on sales/marketing to reignite growth?',
    roles: ['CFO Advisor', 'Growth Expert', 'Operations Analyst', 'Data Strategist'],
    title: 'Cash-flow positive but growth slowing. Cut costs or invest?',
  },
  {
    mode: ChatModes.SOLVING,
    preferredModelIds: [ModelIds.OPENAI_O3, ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.X_AI_GROK_4, ModelIds.GOOGLE_GEMINI_2_5_PRO],
    prompt: 'Our VP of Engineering (5 years, built the whole platform) just got a $450K offer from our main competitor. He currently makes $280K + 1.5% equity. Counter-offer with a $350K + 0.5% refresh, let him go gracefully, or remind him of his 2-year non-compete?',
    roles: ['HR Strategist', 'Practical Evaluator', 'Legal Counsel', 'Culture Advisor'],
    title: 'Key executive leaving for competitor. Counter-offer or let go?',
  },
  {
    mode: ChatModes.BRAINSTORMING,
    preferredModelIds: [ModelIds.OPENAI_GPT_5_1, ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.X_AI_GROK_4, ModelIds.MISTRALAI_MISTRAL_LARGE_2512],
    prompt: 'We\'re #3 in our market ($8M ARR). #1 and #2 just merged. A smaller competitor ($2M ARR) is available for $5M. We have $3M cash. Take debt to acquire them and become #2, focus on profitability to become attractive acquisition target, or keep competing as is?',
    roles: ['Visionary Thinker', 'M&A Advisor', 'Market Analyst', 'Strategic Planner'],
    title: 'Market consolidating. Acquire a smaller player or be acquired?',
  },
  // Product Management
  {
    mode: ChatModes.DEBATING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.DEEPSEEK_DEEPSEEK_V3_2],
    prompt: 'Our top 5 enterprise customers ($1.2M combined ARR) are demanding Salesforce integration. Building it requires 3 months and pulls us away from our AI roadmap which we believe is our moat. They\'ve hinted they\'ll churn without it. Build the integration, hold firm on AI strategy, or offer a discount to buy time?',
    roles: ['Product Strategist', 'Customer Success Lead', 'Devil\'s Advocate', 'Tech Lead'],
    title: 'Users want feature X, but it conflicts with strategy. Build it?',
  },
  {
    mode: ChatModes.SOLVING,
    preferredModelIds: [ModelIds.OPENAI_GPT_5_1, ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.GOOGLE_GEMINI_3_1_PRO_PREVIEW, ModelIds.X_AI_GROK_4],
    prompt: 'We planned to launch AI-powered analytics next quarter—our main differentiator. Competitor just shipped it last week, getting press coverage. We\'re 2 months from launch with arguably better implementation. Ship anyway and compete on quality, pivot to a different AI feature, or accelerate launch and cut scope?',
    roles: ['Competitive Analyst', 'Product Lead', 'Practical Evaluator', 'UX Strategist'],
    title: 'Competitor launched our roadmap feature. Pivot or execute better?',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.OPENAI_O3, ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.MISTRALAI_MISTRAL_LARGE_2512],
    prompt: 'Three Fortune 500 prospects ($800K combined ACV) require on-premises deployment. Engineering estimates 6 months to build and 40% slower feature velocity ongoing. Current ARR is $3M, all cloud. Accept the architectural complexity for $800K, decline and stay cloud-only, or offer a hybrid compromise?',
    roles: ['Enterprise Advisor', 'Engineering Lead', 'Revenue Strategist', 'Risk Analyst'],
    title: 'Enterprise wants on-prem but it slows velocity 40%. Worth it?',
  },
  {
    mode: ChatModes.BRAINSTORMING,
    preferredModelIds: [ModelIds.OPENAI_GPT_5, ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.X_AI_GROK_4, ModelIds.DEEPSEEK_DEEPSEEK_V3_2],
    prompt: 'Our free tier has 50K users with 2% converting to paid ($50/mo). Conversion dropped from 4% as free features expanded. Free users cost $3/mo to serve. Kill free tier entirely, add aggressive limits (storage, exports), or double down on viral features hoping volume compensates?',
    roles: ['Growth Analyst', 'Visionary Thinker', 'Monetization Expert', 'Product Strategist'],
    title: 'Free tier cannibalizing paid. Kill it or lean into viral growth?',
  },
  // Legal
  {
    mode: ChatModes.DEBATING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    prompt: 'We\'re \'Beacon Analytics\' (2 years old, $2M brand investment). Received C&D from \'Beacon Insurance\' (Fortune 500). Our lawyer says we\'d likely win (different industries) but litigation costs $300K+. Rebrand for ~$500K, fight it, or offer coexistence agreement with geographic/industry restrictions?',
    roles: ['IP Attorney', 'Brand Strategist', 'Devil\'s Advocate', 'Risk Advisor'],
    title: 'Cease & desist on trademark. Fight, rebrand, or negotiate?',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.OPENAI_GPT_5, ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.GOOGLE_GEMINI_3_1_PRO_PREVIEW, ModelIds.MISTRALAI_MISTRAL_LARGE_2512],
    prompt: 'Terminated employee (sales, 18 months tenure, documented performance issues) is threatening wrongful termination suit claiming discrimination. Their lawyer is asking $150K to settle. Our lawyer estimates $80K to litigate with 70% win probability. Settle quickly to avoid PR, litigate to avoid setting precedent, or counter-offer at $75K?',
    roles: ['Employment Counsel', 'HR Advisor', 'PR Strategist', 'Risk Analyst'],
    title: 'Employee alleges wrongful termination. Settle or litigate?',
  },
  {
    mode: ChatModes.SOLVING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_O3, ModelIds.X_AI_GROK_4, ModelIds.DEEPSEEK_DEEPSEEK_V3_2],
    prompt: 'Patent troll is suing us for $2M over a vague \'data synchronization\' patent. They\'ve settled with 12 other companies for $200-400K each. Our tech clearly differs but litigation costs $500K+. Pay $300K to settle, fight to set precedent for the industry, or spend $100K on prior art search first?',
    roles: ['Patent Attorney', 'Practical Evaluator', 'Technical Expert', 'Cost Analyst'],
    title: 'Patent troll lawsuit. Settle, fight, or find prior art?',
  },
  // Healthcare
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.OPENAI_GPT_5, ModelIds.X_AI_GROK_4],
    prompt: 'Stage 4 pancreatic cancer patient, 68yo, otherwise healthy. Standard chemo offers 8% 2-year survival. New immunotherapy trial shows 22% in early data (n=45) but severe side effects in 30% of cases. Patient has good insurance, wants to fight. Recommend trial, standard treatment, or palliative care focus?',
    roles: ['Oncologist', 'Medical Ethicist', 'Patient Advocate', 'Data Analyst'],
    title: 'New treatment promising but limited data. Recommend to patient?',
  },
  {
    mode: ChatModes.DEBATING,
    preferredModelIds: [ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_3_1_PRO_PREVIEW, ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.DEEPSEEK_DEEPSEEK_V3_2],
    prompt: 'Patient with complex cardiac + kidney issues. Cardiologist recommends surgery (15% mortality risk, fixes heart). Nephrologist says surgery will accelerate kidney failure requiring dialysis within a year. Patient is 58, active, values quality of life. Surgery with kidney risk, medical management only, or seek third opinion and delay?',
    roles: ['Chief Medical Officer', 'Devil\'s Advocate', 'Care Coordinator', 'Risk Analyst'],
    title: 'Conflicting specialist opinions on treatment. How to proceed?',
  },
  {
    mode: ChatModes.SOLVING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.MISTRALAI_MISTRAL_LARGE_2512],
    prompt: 'ICU at 95% capacity for 8 weeks. Nursing turnover hit 40% annually. Travel nurses cost $150/hr vs $45/hr for staff. Options: reduce beds by 20% (losing $2M/month revenue), hire travel nurses ($800K/month extra), or mandatory overtime with retention bonuses ($200K/month). Which approach for the next 6 months?',
    roles: ['Healthcare Administrator', 'Practical Evaluator', 'HR Director', 'Finance Lead'],
    title: 'Staff burnout crisis. Cut capacity or hire expensive travel nurses?',
  },
  // General Board Room
  {
    mode: ChatModes.BRAINSTORMING,
    preferredModelIds: [ModelIds.OPENAI_GPT_5, ModelIds.OPENAI_O3, ModelIds.X_AI_GROK_4, ModelIds.GOOGLE_GEMINI_3_1_PRO_PREVIEW],
    prompt: 'Board mandated 20% cost reduction ($2M annually). Current spend: Engineering $4M, Sales $3M, Marketing $1.5M, G&A $1.5M. Growth is 30% YoY, mostly from sales team. Cut engineering (slow product), cut sales (slow growth), cut marketing (hurt brand), or across-the-board 20% including layoffs?',
    roles: ['CFO Advisor', 'Visionary Thinker', 'Operations Expert', 'Strategic Planner'],
    title: 'Need to cut 20% of costs. Where do we cut without killing growth?',
  },
  {
    mode: ChatModes.BRAINSTORMING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.OPENAI_GPT_5_1, ModelIds.DEEPSEEK_DEEPSEEK_V3_2],
    prompt: 'We run a $10M content writing agency (200 writers). AI tools now produce 70% quality content at 5% of our cost. Revenue down 15% this year. Options: pivot to AI-assisted premium content (layoff 150 writers), become an AI tools reseller, double down on human-only quality positioning, or exit the business while we still can?',
    roles: ['Innovation Lead', 'Visionary Thinker', 'Industry Analyst', 'Strategy Advisor'],
    title: 'Our industry is being disrupted by AI. Adapt, pivot, or ignore?',
  },
  {
    mode: ChatModes.DEBATING,
    preferredModelIds: [ModelIds.OPENAI_GPT_5_1, ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.MISTRALAI_MISTRAL_LARGE_2512, ModelIds.X_AI_GROK_4],
    prompt: 'Our largest customer ($3M of $7.5M ARR) wants exclusive rights to our product in their industry for 3 years. They\'ll pay 25% premium ($750K/year extra). But it blocks us from 4 known prospects worth ~$1M ARR combined. Accept exclusivity, negotiate narrower terms, or decline and risk them churning?',
    roles: ['Revenue Strategist', 'Devil\'s Advocate', 'Legal Counsel', 'Risk Advisor'],
    title: 'Key customer with 40% revenue demanding exclusivity. Accept terms?',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5, ModelIds.X_AI_GROK_4],
    prompt: 'Our COO (co-founder, 10 years) accused of harassment by former employee. Story broke on Twitter, 500K views. No police report, but two other employees corroborated privately. COO denies everything. Suspend immediately pending investigation, issue statement supporting COO, hire external investigator and say nothing, or ask for resignation?',
    roles: ['Crisis Manager', 'Legal Counsel', 'Communications Lead', 'Reputation Analyst'],
    title: 'PR crisis: executive misconduct allegation. Response strategy?',
  },
  // ============================================================================
  // PRESET-SPECIFIC QUICK-START PROMPTS
  // Tagged with presetId — shown when that preset is active
  // ============================================================================
  // Startup Board
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'startup-board',
    prompt: 'We\'re $4M ARR, 40 employees, competitor just got acquired by Microsoft. We have 18 months runway. Seek a buyer while market is hot, raise Series A to compete, or stay bootstrapped and niche down?',
    roles: ['Strategic Advisor', 'Growth Expert', 'CFO Advisor', 'Operations Lead'],
    title: 'Competitor acquired by big tech. Seek buyer, raise, or niche down?',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'startup-board',
    prompt: 'Growth dropped from 8% to 3% MoM but we\'re profitable at $400K/year with $2M in the bank. Cut 20% of staff to extend runway to 3 years, or spend reserves on sales and marketing to reignite growth?',
    roles: ['Strategic Advisor', 'Growth Expert', 'CFO Advisor', 'Operations Lead'],
    title: 'Profitable but growth stalling. Cut costs or invest to reignite?',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'startup-board',
    prompt: 'VP of Engineering (5 years, built the whole platform) got a $450K offer from our main competitor. He makes $280K + 1.5% equity. Counter-offer with $350K + refresh, let him go gracefully, or enforce 2-year non-compete?',
    roles: ['Strategic Advisor', 'Growth Expert', 'CFO Advisor', 'Operations Lead'],
    title: 'Key executive leaving for competitor. Counter-offer or let go?',
  },
  // Market Intelligence
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'market-intelligence',
    prompt: 'Analyze CrowdStrike\'s competitive position — pull SEC financials for revenue quality and margins, Finnhub market data for positioning, and FRED macro indicators for cybersecurity spending trends.',
    roles: ['Industry Analyst', 'Competitive Strategist', 'Quantitative Analyst', 'Trend Forecaster'],
    title: 'CrowdStrike competitive analysis with financial data',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'market-intelligence',
    prompt: 'Map the competitive landscape in vertical SaaS for construction — market size, key players, recent M&A activity, growth trends, and where the market is heading. Use SEC and Finnhub data for public players.',
    roles: ['Industry Analyst', 'Competitive Strategist', 'Quantitative Analyst', 'Trend Forecaster'],
    title: 'Competitive landscape: vertical SaaS for construction',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'market-intelligence',
    prompt: 'Industry disruption analysis: how is AI impacting the content writing industry? Pull financial data on public content/media companies from SEC filings, check FRED for advertising spend trends, and Finnhub for market signals.',
    roles: ['Industry Analyst', 'Competitive Strategist', 'Quantitative Analyst', 'Trend Forecaster'],
    title: 'AI disruption analysis: content writing industry',
  },
  // Technical Architecture
  {
    mode: ChatModes.SOLVING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'technical-architecture',
    prompt: 'Design a real-time collaborative editing system like Google Docs. Consider consistency models (OT vs CRDT), latency requirements, offline support, conflict resolution, and scaling to 10M concurrent documents.',
    roles: ['Systems Architect', 'Security Engineer', 'Performance Engineer', 'DevOps Lead'],
    title: 'Design a real-time collaborative editing system',
  },
  {
    mode: ChatModes.SOLVING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'technical-architecture',
    prompt: 'Our API p99 latency jumped from 200ms to 2s after adding a new microservice. The service handles user preference lookups and is called on every request. Diagnose likely causes and propose architecture fixes.',
    roles: ['Systems Architect', 'Security Engineer', 'Performance Engineer', 'DevOps Lead'],
    title: 'API latency 10x after new microservice. Diagnose and fix.',
  },
  {
    mode: ChatModes.SOLVING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'technical-architecture',
    prompt: 'Migrate a monolith to microservices for a 500K DAU app. Current stack: Rails monolith, PostgreSQL, Redis. What to split first, how to handle shared data, deployment strategy, and how to avoid the distributed monolith trap?',
    roles: ['Systems Architect', 'Security Engineer', 'Performance Engineer', 'DevOps Lead'],
    title: 'Monolith to microservices migration for 500K DAU app',
  },
  // Legal Council
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'legal-council',
    prompt: 'Received C&D from a Fortune 500 on our trademark \'Beacon Analytics\' — they\'re \'Beacon Insurance\' in a different industry. Our lawyer says we\'d likely win but litigation costs $300K+. Fight, rebrand ($500K), or negotiate coexistence?',
    roles: ['Lead Counsel', 'Regulatory Advisor', 'IP Specialist', 'Risk Analyst'],
    title: 'Trademark C&D from Fortune 500. Fight, rebrand, or negotiate?',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'legal-council',
    prompt: 'Terminated employee (18 months, documented performance issues) alleges wrongful termination and discrimination. Their lawyer asks $150K to settle. Our lawyer estimates $80K litigation with 70% win probability. Settle, litigate, or counter-offer?',
    roles: ['Lead Counsel', 'Regulatory Advisor', 'IP Specialist', 'Risk Analyst'],
    title: 'Wrongful termination claim. Settle at $150K or litigate?',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'legal-council',
    prompt: 'Patent troll suing for $2M over a vague \'data synchronization\' patent. They\'ve settled with 12 companies for $200-400K each. Our tech clearly differs but litigation costs $500K+. Settle, fight for precedent, or prior art search first?',
    roles: ['Lead Counsel', 'Regulatory Advisor', 'IP Specialist', 'Risk Analyst'],
    title: 'Patent troll lawsuit. Settle, fight, or find prior art?',
  },
  // Creative Strategy
  {
    mode: ChatModes.BRAINSTORMING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.OPENAI_GPT_5, ModelIds.GOOGLE_GEMINI_3_1_PRO_PREVIEW, ModelIds.X_AI_GROK_4],
    presetId: 'creative-strategy',
    prompt: 'Launch campaign for a developer tool — zero marketing budget, need to go from 0 to 1K users in 3 months. What channels, content, and tactics would you prioritize?',
    roles: ['Creative Director', 'Audience Analyst', 'Content Strategist', 'Growth Marketer'],
    title: 'Zero-budget launch: 0 to 1K users in 3 months',
  },
  {
    mode: ChatModes.BRAINSTORMING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.OPENAI_GPT_5, ModelIds.GOOGLE_GEMINI_3_1_PRO_PREVIEW, ModelIds.X_AI_GROK_4],
    presetId: 'creative-strategy',
    prompt: 'Our SaaS brand feels generic — same blue gradient, same "all-in-one platform" messaging as 50 competitors. Develop a distinctive brand voice and positioning strategy that actually stands out.',
    roles: ['Creative Director', 'Audience Analyst', 'Content Strategist', 'Growth Marketer'],
    title: 'Generic SaaS brand. Develop distinctive voice and positioning.',
  },
  {
    mode: ChatModes.BRAINSTORMING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.OPENAI_GPT_5, ModelIds.GOOGLE_GEMINI_3_1_PRO_PREVIEW, ModelIds.X_AI_GROK_4],
    presetId: 'creative-strategy',
    prompt: 'Plan content strategy for a B2B fintech — blog, social, email. What topics drive pipeline? Which channels for which funnel stages? What cadence is sustainable for a 2-person marketing team?',
    roles: ['Creative Director', 'Audience Analyst', 'Content Strategist', 'Growth Marketer'],
    title: 'B2B fintech content strategy: topics, channels, and cadence',
  },
  // M&A Advisory
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'm-and-a-advisory',
    prompt: 'Evaluate Shopify as an acquisition target at current valuation. Pull SEC financials for revenue quality and margin trends, Finnhub for market data and insider activity, and FRED for macro environment. Assess fair value range, key risks, and strategic rationale.',
    roles: ['Financial Analyst', 'Legal Counsel', 'Market Strategist', 'Operations Advisor'],
    title: 'Evaluate Shopify as an acquisition target at current valuation',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'm-and-a-advisory',
    prompt: 'Antitrust risk assessment: a major tech company is acquiring a $5B cybersecurity competitor with 15% market share. Analyze HHI concentration, DOJ/FTC review likelihood, required divestitures, and regulatory timeline impact on deal structure.',
    roles: ['Financial Analyst', 'Legal Counsel', 'Market Strategist', 'Operations Advisor'],
    title: 'Antitrust risk: tech giant acquiring a $5B competitor',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'm-and-a-advisory',
    prompt: 'Our PE portfolio company (B2B SaaS, $40M ARR, 20% growth) received a take-private offer at 6x EBITDA. Should we accept, negotiate for better terms, or self-fund growth to a higher exit multiple? Consider current FRED rate environment and comparable Finnhub multiples.',
    roles: ['Financial Analyst', 'Legal Counsel', 'Market Strategist', 'Operations Advisor'],
    title: 'Take-private offer at 6x EBITDA — accept, negotiate, or self-fund?',
  },
  // Investment Committee
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.OPENAI_O3, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.X_AI_GROK_4],
    presetId: 'investment-committee',
    prompt: 'Series B investment memo: autonomous trucking startup seeking $50M at $300M pre-money. $12M ARR, 180% YoY growth, -$4M/month burn. 2 funded competitors. Build the full investment case — unit economics, risk matrix, return modeling with bull/base/bear scenarios.',
    roles: ['Lead Analyst', 'Market Research', 'Risk Officer', 'Portfolio Strategist'],
    title: 'Series B memo: autonomous trucking at $300M pre-money',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.OPENAI_O3, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.X_AI_GROK_4],
    presetId: 'investment-committee',
    prompt: 'Portfolio company hit $8M ARR but growth decelerated from 150% to 60% YoY. They need a $20M bridge at flat valuation. Should we lead the bridge, participate pro-rata, or let the company find alternative funding? Analyze bridge vs. let-fail economics and signaling risk.',
    roles: ['Lead Analyst', 'Market Research', 'Risk Officer', 'Portfolio Strategist'],
    title: 'Struggling portfolio co needs $20M bridge — lead or pass?',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.OPENAI_O3, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.ANTHROPIC_CLAUDE_SONNET_4_6, ModelIds.X_AI_GROK_4],
    presetId: 'investment-committee',
    prompt: 'Public market analysis: is CrowdStrike overvalued at 20x forward revenue? Build bull, base, and bear scenarios using SEC filing data for financial fundamentals, Finnhub for market positioning, and FRED for macro rate environment impact on growth multiples.',
    roles: ['Lead Analyst', 'Market Research', 'Risk Officer', 'Portfolio Strategist'],
    title: 'CrowdStrike at 20x revenue — overvalued or justified?',
  },
  // Clinical Board
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'clinical-board',
    prompt: 'New-onset seizures in a 28-year-old with a ring-enhancing brain lesion on MRI. Build the differential diagnosis with probability estimates, recommended workup sequence, and check ClinicalTrials.gov for relevant active trials. Cross-reference OpenFDA for anticonvulsant safety profiles.',
    roles: ['Attending Physician', 'Specialist Consultant', 'Clinical Pharmacologist', 'Patient Safety Officer'],
    title: 'New-onset seizures with ring-enhancing brain lesion',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'clinical-board',
    prompt: 'Compare pembrolizumab + chemotherapy vs chemotherapy alone for newly diagnosed triple-negative breast cancer (Stage II, PD-L1 CPS 15). Review PubMed evidence, check ClinicalTrials.gov for ongoing Phase III trials, and cross-reference OpenFDA for adverse event profiles of both regimens.',
    roles: ['Attending Physician', 'Specialist Consultant', 'Clinical Pharmacologist', 'Patient Safety Officer'],
    title: 'Pembrolizumab + chemo vs chemo alone for triple-negative breast cancer',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'clinical-board',
    prompt: 'Complex polypharmacy review: 72-year-old with CHF (EF 25%), CKD Stage 3b, Type 2 diabetes, and atrial fibrillation on 10 medications. Check OpenFDA for drug-drug interactions and black box warnings, cross-reference PubMed for dosing adjustments in renal impairment.',
    roles: ['Attending Physician', 'Specialist Consultant', 'Clinical Pharmacologist', 'Patient Safety Officer'],
    title: 'Polypharmacy review: CHF + CKD + diabetes + afib on 10 meds',
  },
  // Product Strategy
  {
    mode: ChatModes.DEBATING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'product-strategy',
    prompt: 'Our top 5 enterprise customers ($1.2M combined ARR) are demanding a Salesforce integration. Building it takes 3 months and pulls us off our AI roadmap — which we believe is our moat. They\'ve hinted they\'ll churn without it. Build the integration, hold firm on AI strategy, or offer a discount to buy time?',
    roles: ['Product Lead', 'Engineering Lead', 'Data Analyst', 'Customer Advocate'],
    title: 'Feature X conflicts with strategy — build or hold?',
  },
  {
    mode: ChatModes.DEBATING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'product-strategy',
    prompt: 'We need a real-time collaboration engine. Option A: build in-house with CRDTs (6 months, full control, ongoing maintenance). Option B: buy a commercial SDK ($50K/year, ships in 2 weeks, vendor dependency). Our core product isn\'t collaboration — it\'s analytics. What\'s the right call?',
    roles: ['Product Lead', 'Engineering Lead', 'Data Analyst', 'Customer Advocate'],
    title: 'Build vs buy decision for core infra',
  },
  {
    mode: ChatModes.DEBATING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'product-strategy',
    prompt: 'Considering switching from per-seat pricing ($50/user/mo) to usage-based pricing (API calls + storage). Current: $3M ARR, 500 customers, avg 12 seats. Usage-based could expand TAM but risks revenue unpredictability and enterprise pushback. Model the trade-offs and recommend an approach.',
    roles: ['Product Lead', 'Engineering Lead', 'Data Analyst', 'Customer Advocate'],
    title: 'Pricing model change: usage-based vs seat-based',
  },
  // Research Council
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_O3, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'research-council',
    prompt: 'Conduct a systematic review of CAR-T cell therapy efficacy in relapsed/refractory B-cell lymphomas. Pull PubMed for meta-analyses and Phase III RCTs from 2020-present. Assess complete response rates, durability of response, cytokine release syndrome incidence, and identify gaps in current evidence.',
    roles: ['Principal Investigator', 'Methodologist', 'Domain Expert', 'Critical Reviewer'],
    title: 'Systematic review: CAR-T therapy efficacy in lymphomas',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_O3, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'research-council',
    prompt: 'Critique this NIH R01 grant proposal: studying the gut-brain axis in treatment-resistant depression using fecal microbiota transplantation. Assess hypothesis strength, proposed methodology (double-blind RCT, n=120), statistical power, ethical considerations, and likelihood of funding success.',
    roles: ['Principal Investigator', 'Methodologist', 'Domain Expert', 'Critical Reviewer'],
    title: 'Grant proposal critique for NIH R01',
  },
  {
    mode: ChatModes.ANALYZING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_O3, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'research-council',
    prompt: 'Compare methodologies for studying the effect of social media on adolescent mental health. Evaluate longitudinal cohort studies vs. ecological momentary assessment vs. natural experiments (platform policy changes). Which approach offers the strongest causal evidence while being practically feasible?',
    roles: ['Principal Investigator', 'Methodologist', 'Domain Expert', 'Critical Reviewer'],
    title: 'Compare methodologies for studying social media and mental health',
  },
  // Cybersecurity Council
  {
    mode: ChatModes.SOLVING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'cybersecurity-council',
    prompt: 'Threat model a multi-tenant SaaS application handling PII and payment data. Architecture: React frontend, Node.js API, PostgreSQL, Redis, deployed on AWS EKS. Identify top 10 threats using STRIDE, map to MITRE ATT&CK techniques, and recommend prioritized security controls.',
    roles: ['Threat Analyst', 'Security Architect', 'Compliance Officer', 'Incident Responder'],
    title: 'Threat model for multi-tenant SaaS app',
  },
  {
    mode: ChatModes.SOLVING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'cybersecurity-council',
    prompt: 'SOC 2 Type II compliance gap analysis for a 50-person B2B SaaS company. Current state: AWS infrastructure, GitHub for code, Okta for SSO, no formal security policies, annual penetration test, basic logging. Identify gaps across all 5 trust service criteria and create a 90-day remediation roadmap.',
    roles: ['Threat Analyst', 'Security Architect', 'Compliance Officer', 'Incident Responder'],
    title: 'SOC 2 Type II compliance gap analysis',
  },
  {
    mode: ChatModes.SOLVING,
    preferredModelIds: [ModelIds.ANTHROPIC_CLAUDE_OPUS_4_6, ModelIds.OPENAI_GPT_5_1, ModelIds.GOOGLE_GEMINI_2_5_PRO, ModelIds.X_AI_GROK_4],
    presetId: 'cybersecurity-council',
    prompt: 'Develop an incident response plan for a ransomware attack on a mid-size healthcare organization (500 employees, on-prem + cloud hybrid, HIPAA-regulated). Cover detection, containment, eradication, recovery, and post-incident phases. Include communication templates and regulatory notification timelines.',
    roles: ['Threat Analyst', 'Security Architect', 'Compliance Officer', 'Incident Responder'],
    title: 'Incident response plan for ransomware',
  },
];

export type QuickStartData = {
  promptIndices: number[];
  providerOffset: number;
};

/**
 * Deterministic PRNG (mulberry32) — same seed produces identical sequence
 * on both server and client, preventing hydration mismatches.
 */
function seededRandom(seed: number): () => number {
  let t = seed + 0x6D2B79F5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Quick start suggestion selection.
 *
 * Fresh random selection on every call — no caching.
 * The route loader uses `staleTime: 0` so each server navigation
 * produces a new set of suggestions.
 *
 * Uses a seeded PRNG with a high-resolution timestamp so that
 * server and client produce identical indices for the same request
 * (the seed is embedded in the returned data for hydration).
 */
export function getServerQuickStartData(): QuickStartData {
  const seed = Math.floor(Math.random() * 2147483647);
  const random = seededRandom(seed);

  // Fisher-Yates shuffle indices with deterministic random
  const indices = Array.from({ length: PROMPT_POOL.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = indices[i];
    const swapValue = indices[j];
    if (temp !== undefined && swapValue !== undefined) {
      indices[i] = swapValue;
      indices[j] = temp;
    }
  }
  return {
    promptIndices: indices.slice(0, 3),
    providerOffset: Math.floor(random() * 10),
  };
}

/**
 * Get prompt templates by pre-selected indices (from server loader data).
 */
export function getPromptsByIndices(indices: number[]): PromptTemplate[] {
  return indices
    .map(idx => PROMPT_POOL[idx])
    .filter((p): p is PromptTemplate => p !== undefined);
}

/**
 * Get preset-specific quick-start prompts.
 * Returns prompts tagged with the given presetId.
 */
export function getPresetQuickStarts(presetId: string): PromptTemplate[] {
  return PROMPT_POOL.filter(p => p.presetId === presetId);
}
