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
  moderator: `**Consensus:** Chain-of-thought prompting produces genuine improvements on complex reasoning tasks but not universally \u2014 the council agrees on this core finding. **Key insight from dissent:** GPT's challenge about post-hoc rationalization is validated by the research, but Gemini and Grok identify the fix: multi-agent debate on top of CoT catches the confabulation that single-model CoT misses. **Resolution:** CoT is a necessary but insufficient technique. The real accuracy gains come from combining CoT with multi-model verification \u2014 which is precisely what multi-agent debate provides. **Practical recommendation:** Use CoT for complex reasoning tasks, skip it for simple retrieval, and add multi-agent debate for any high-stakes decision where reasoning quality matters.`,
  participants: [
    { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'Research Analyst' },
    { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Devil\'s Advocate' },
    { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Methodology Expert' },
    { modelId: ModelIds.X_AI_GROK_4, role: 'Practitioner' },
  ],
  promptText: 'Does chain-of-thought prompting actually improve reasoning, or does it just make outputs longer? I\'ve seen mixed results in my benchmarks.',
  responses: [
    `The evidence is clear but nuanced. Wei et al. (2022) showed CoT improves performance on complex reasoning tasks by 10-30%, but Du et al. (2023) found the gains are highly task-dependent. **On compositional reasoning \u2014 multi-step math, logical deduction, causal analysis \u2014 CoT is genuinely beneficial. On simple retrieval or pattern matching, it adds noise.** Your benchmark results are exactly what the literature predicts.`,
    `I'll challenge the 'CoT helps reasoning' narrative directly. Turpin et al. (2024) demonstrated that CoT explanations are often post-hoc rationalizations \u2014 the model reaches the answer first, then constructs reasoning to justify it. **What you're measuring as 'improved reasoning' may actually be test-time compute allowing more token-level search.** The O1-style models made this explicit: it's not reasoning, it's scaled inference-time computation.`,
    `GPT's point is important but incomplete. The methodology matters enormously here. **Most CoT benchmarks use a single model generating its own chain-of-thought \u2014 that's where the rationalization problem lives.** When you add multi-agent verification on top of CoT, the picture changes dramatically. Li et al. (2024) showed that multi-agent debate with CoT eliminates the confabulation problem because other models fact-check the reasoning chain, not just the conclusion.`,
    `Let me ground this in production reality. **CoT alone is fragile. CoT + multi-agent debate is where the real gains live.** The ICML 2024 findings (Khan et al.) showed +28pp accuracy improvement specifically when combining chain-of-thought with structured debate between models. In my experience, CoT gives you the reasoning scaffold, but without adversarial pressure from other models, that scaffold can be built on fabricated foundations.`,
  ],
  userMessage: 'I\'ve been running benchmarks on chain-of-thought prompting across different tasks. On math and logic problems, CoT gives a clear boost. But on factual QA and summarization, it barely moves the needle \u2014 and sometimes makes things worse by introducing reasoning errors. The research seems split too. Is CoT actually improving reasoning, or is it mostly test-time compute theater?',
};

export function MultiAgentDebateHeroDemo() {
  return <HeroDemoBase data={DATA} />;
}
