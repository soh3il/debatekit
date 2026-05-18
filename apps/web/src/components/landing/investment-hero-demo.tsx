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
  moderator: `**Consensus:** The council is split \u2014 Claude sees the guidance miss as noise in a generational growth story, while GPT and Grok flag deceleration risk and rich valuation. **Key agreement:** All four models recognize NVIDIA's dominance in AI infrastructure is real. The debate is about cycle duration, not company quality. **Unresolved tension:** Gemini's macro framing \u2014 whether the AI capex supercycle has 8 or 18 quarters left \u2014 is the critical variable. **Actionable insight:** Wait for either (a) a 15-20% pullback for better risk/reward, or (b) re-acceleration in guidance beats to confirm cycle extension.`,
  participants: [
    { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Bull Case Analyst' },
    { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Bear Case Analyst' },
    { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Macro Strategist' },
    { modelId: ModelIds.X_AI_GROK_4, role: 'Valuation Expert' },
  ],
  promptText: 'Analyze NVIDIA after Q4 earnings \u2014 revenue up 78% YoY but guidance below street estimates. Bull or bear from here?',
  responses: [
    `The 78% YoY growth at this scale is extraordinary \u2014 NVIDIA is printing money in data center. The guidance 'miss' is $43B vs $45B expectations, but that's still 65%+ growth. The real story is inference demand hasn't even kicked in yet \u2014 training capex is the appetizer. **The after-hours drop is a gift. Every major hyperscaler just told you they're increasing AI capex in 2026.**`,
    `Claude's framing is exactly the kind of momentum thinking that gets people hurt at cycle tops. The guidance miss isn't about the absolute number \u2014 it's about deceleration of the beat-and-raise pattern. When a $1.8T company starts guiding below consensus, the market re-rates the multiple, not the revenue. **I'd also flag the China export restriction headwinds that management barely addressed on the call.**`,
    `I want to zoom out from the bull-bear binary. The macro setup is what matters: Big Tech committed $650B in AI capex for 2026 (Bridgewater estimate), but if rates stay higher-for-longer and enterprise AI ROI disappoints, that capex cycle shortens fast. NVIDIA is a leveraged bet on the AI capex cycle continuing. **The question isn't whether NVIDIA is a great company \u2014 it's whether the capex cycle has 8 quarters left or 18.**`,
    `At 35x forward earnings with decelerating guidance beats, the risk/reward is asymmetric to the downside. Gemini is right that this is a macro-cycle question more than a company question. The comp here isn't other semis \u2014 it's Cisco in 2000, trading at 30x on infrastructure build-out. **I'd wait for a 20% pullback or a re-acceleration in guidance beats before adding to the position.**`,
  ],
  userMessage: 'NVIDIA just reported Q4 earnings. Revenue $39.3B, up 78% YoY, but Q1 guidance of $43B came in below the $45B consensus. The stock dropped 6% after-hours. Should we be buying the dip or is this a top signal?',
};

export function InvestmentHeroDemo() {
  return <HeroDemoBase data={DATA} />;
}
