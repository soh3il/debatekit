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
  moderator: `**Consensus:** The council unanimously recommends **do not sign as drafted** \u2014 all four models identify material risk. **Key findings:** (1) Auto-renewal structure creates a hidden multi-year commitment (Claude), (2) DPA is non-compliant with GDPR Article 28 (GPT), (3) IP assignment clause transfers ownership of our operational configurations to the vendor (Gemini), (4) Combined indemnification and DPA gaps create uncapped litigation exposure (Grok). **Recommended redlines:** 90-day termination notice, mutual indemnification with cap, full IP retention for custom work, GDPR-compliant DPA with defined security measures, and quarterly audit rights. Send revised terms to vendor before Thursday deadline.`,
  participants: [
    { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Contract Analyst' },
    { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Compliance Reviewer' },
    { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'IP Specialist' },
    { modelId: ModelIds.X_AI_GROK_4, role: 'Litigation Assessor' },
  ],
  promptText: 'Review this SaaS vendor agreement \u2014 $2.4M annual commitment with auto-renewal, broad indemnification, and IP assignment clauses...',
  responses: [
    `The auto-renewal with 180-day notice is the first red flag. That's effectively a 3-year minimum commitment disguised as annual \u2014 miss the window by one day and you're locked in for another year at $2.4M. The indemnification clause is unusually broad too: it covers 'any claims arising from use,' which could include third-party data breaches on *their* infrastructure. I'd want a mutual indemnification carve-out and a 90-day notice-to-terminate at minimum. **The economics look like annual pricing, but the exit structure is multi-year.**`,
    `Claude's right about the indemnification scope, but there's a bigger issue: the data processing addendum references 'standard security practices' without defining them. Under GDPR Article 28, that's insufficient \u2014 we need specific technical and organizational measures documented. If this vendor processes any EU customer data, we're taking on compliance liability for *their* security posture. I'd also flag the audit rights clause \u2014 it limits inspections to 'once per calendar year with 60 days notice,' which is below our regulatory baseline. **We can't sign this without a compliant DPA.**`,
    `The IP assignment clause is the most dangerous provision in this agreement. Section 8.3 assigns ownership of 'all customizations, configurations, and derivative works' to the vendor. That means every workflow we build, every integration we configure, every report template we create \u2014 it all belongs to them. If we ever switch vendors, we lose our own operational IP. GPT's DPA concern is valid, but **this clause could cost us millions in rebuilding costs if we ever need to migrate.**`,
    `Gemini's IP analysis is the dealbreaker. But I want to quantify the litigation exposure Claude and GPT flagged. The indemnification clause, combined with the weak DPA, creates a scenario where we're liable for a data breach on *their* systems \u2014 and we can't even audit them more than once a year. Our exposure in a breach scenario is uncapped. Similar clauses have produced $5-15M settlements in recent SaaS disputes. **The contract needs a liability cap, mutual indemnification, and an enhanced DPA before we can recommend signing.**`,
  ],
  userMessage: 'We need to sign a $2.4M/year enterprise SaaS agreement. It has auto-renewal with 180-day notice, broad indemnification obligations, and an IP assignment clause for any customizations. Legal review needed before Thursday board meeting.',
};

export function LegalHeroDemo() {
  return <HeroDemoBase data={DATA} />;
}
