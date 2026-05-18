import { ModelIds } from '@debatekit/shared';

import type { HeroDemoData } from './hero-demo-base';
import { HeroDemoBase } from './hero-demo-base';

const DATA: HeroDemoData = {
  composerModels: [
    ModelIds.ANTHROPIC_CLAUDE_SONNET_4,
    ModelIds.OPENAI_GPT_4_1,
    ModelIds.GOOGLE_GEMINI_2_5_PRO,
    ModelIds.DEEPSEEK_DEEPSEEK_V3_2,
  ],
  moderator: `**4 compliance gaps identified across 3 risk levels.** Claude flagged the regulatory requirements and timeline pressure; GPT-4o mapped the current state revealing 0 of 12 controls fully met; Gemini scored the gaps with high-risk production systems as CRITICAL; DeepSeek synthesized a phased remediation plan. **Key agreement:** All four identify the unclassified high-risk AI systems as the most urgent exposure. **Recommended:** 90-day phased remediation starting with high-risk AI system classification and transparency notices. **Estimated regulatory exposure if unaddressed: \u20AC2-4M in potential fines.**`,
  participants: [
    { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Regulatory Monitor' },
    { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Gap Analyst' },
    { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Risk Prioritizer' },
    { modelId: ModelIds.DEEPSEEK_DEEPSEEK_V3_2, role: 'Advisory Drafter' },
  ],
  promptText: 'Assess our compliance posture for the EU AI Act taking effect. We deploy customer-facing AI systems across 3 business units...',
  responses: [
    `The EU AI Act entered into force with a phased compliance timeline. Four requirements are immediately relevant: **risk classification of all AI systems** (Article 6), **transparency obligations** for customer-facing AI (Article 52), **conformity assessments** for high-risk systems (Article 43), and **prohibited practices** screening (Article 5). Your recommendation engines likely qualify as high-risk under Annex III if they influence purchasing decisions. The automated decision systems almost certainly require human oversight provisions. **The clock is ticking \u2014 high-risk system requirements apply within 24 months of entry into force.**`,
    `Mapping current state against Claude's requirements reveals significant gaps. **No AI risk classification system exists** \u2014 none of the three business units have categorized their systems under the Act's risk tiers. Documentation gaps are severe: no training data provenance records, no model cards, no bias testing documentation. There is **no conformity assessment process** in place, which is required before any high-risk system can be deployed in the EU. The transparency gap is also critical \u2014 your customer-facing chatbots have no disclosure that users are interacting with AI. **Of 12 required compliance controls, we currently meet 2 partially and 0 fully.**`,
    `Scoring severity across all identified gaps: the high-risk AI systems operating in production without documentation or conformity assessment are **CRITICAL** \u2014 this represents the largest regulatory exposure and must be addressed first. Missing transparency notices on customer-facing chatbots score as **HIGH** \u2014 regulators have signaled this will be an early enforcement priority. The absence of a designated AI compliance officer is **MEDIUM** \u2014 it's foundational but not directly penalized. I'd also flag that the recommendation engines need immediate classification review: **if they're deemed high-risk, the compliance burden triples and the timeline compresses.**`,
    `Synthesizing into an actionable 90-day remediation roadmap. **Immediate actions (Days 1-14):** Appoint an AI compliance officer, classify all AI systems by risk tier, and implement transparency notices on chatbots. **Phase 1 (Days 15-45):** Establish training data documentation pipeline, begin conformity assessment process for high-risk systems, and conduct prohibited practices audit. **Phase 2 (Days 46-90):** Implement risk management framework per Article 9, deploy monitoring systems for high-risk AI, and complete initial conformity assessments. **Estimated investment: 2-3 FTEs dedicated plus external legal counsel for conformity assessments.**`,
  ],
  userMessage: 'We need a compliance assessment for the EU AI Act. Our SaaS platform deploys AI-powered chatbots, recommendation engines, and automated decision systems across EU markets. No formal AI governance framework exists yet.',
};

export function ComplianceHeroDemo() {
  return <HeroDemoBase data={DATA} />;
}
