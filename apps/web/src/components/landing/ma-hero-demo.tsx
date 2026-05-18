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
  moderator: `**Consensus:** The council recommends **conditional pursuit** \u2014 but the models disagree on what you're buying. Claude and GPT frame this as a margin-recovery play contingent on customer retention; Gemini argues the IP portfolio is the real asset and the manufacturing revenue is secondary. **Key agreement:** All four flag the top customer as the critical variable \u2014 both the revenue risk (Claude, Grok) and the IP ownership risk (GPT). **Unresolved tension:** Grok challenges Gemini's IP thesis, arguing the patents may be narrower than the CIM implies. **Next step:** Request the top 3 customer MSAs and a detailed patent portfolio review before committing diligence resources.`,
  participants: [
    { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Financial Analyst' },
    { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Legal Counsel' },
    { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Strategic Advisor' },
    { modelId: ModelIds.X_AI_GROK_4, role: 'Risk Assessor' },
  ],
  promptText: 'Analyze this CIM for a $45M manufacturing company with declining margins and 40% customer concentration...',
  responses: [
    `The declining margins are the real story. At $45M with compressing EBITDA, I need to know if this is pricing pressure or cost bloat \u2014 the fix is completely different. If we can add back one-time items to get adjusted margins above 15%, there's a restructuring thesis. But with 40% customer concentration, any margin recovery depends on a customer that could walk. That's the tension: **the financial upside and the biggest risk are the same customer.**`,
    `Claude's margin thesis depends entirely on that top customer staying. But here's what concerns me: if there's a change-of-control clause in the MSA, the deal thesis collapses before we even get to the margin question. And 40% concentration means we're almost certainly dealing with bespoke contractual terms \u2014 I'd want to see IP ownership structure too. If any patents were co-developed with that customer, they may have a claim. **We need the MSAs before the financial model matters.**`,
    `I want to push back on both of you framing this as a margin play. The IP portfolio could be the real asset here. If those patents create a defensible moat, this isn't a declining manufacturer \u2014 it's an undermonetized technology company that happens to do manufacturing. The question isn't whether margins recover; it's whether we have a platform company that could license this IP at 10x the current revenue. **The thesis changes completely depending on what we're actually buying.**`,
    `Gemini's reframe is compelling but assumes the IP is broader than the CIM suggests. Worst case: top customer churns post-close, margins keep compressing, and the patents turn out to be narrow process improvements, not a licensable moat. I'd also flag key-person risk \u2014 if the founder is the only one who understands the patent portfolio, that knowledge walks out the door. Claude's right that the financial upside and the risk are the same customer, but **the downside is asymmetric: losing that customer costs revenue, margin, and potentially the IP thesis.**`,
  ],
  userMessage: 'We received a CIM for a $45M revenue manufacturing company. 40% customer concentration, declining margins, but strong IP portfolio. Should we pursue?',
};

export function MAHeroDemo() {
  return <HeroDemoBase data={DATA} />;
}
