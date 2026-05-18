'use client';

import { CardVariants } from '@debatekit/shared';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useState } from 'react';

import { Icons } from '@/components/icons';
import { DEMO_SCENARIO_TABS, DEMO_SCENARIOS } from '@/components/landing/data/demo-scenarios';
import { LandingBrowserFrame } from '@/components/landing/landing-browser-frame';
import { MCPConfigDemo } from '@/components/landing/mcp-config-demo';
import { MCPPlatformCodeBlock } from '@/components/landing/mcp-platform-code-block';
import { MCPTerminalDemo } from '@/components/landing/mcp-terminal-demo';
import { AnimatedCardGrid } from '@/components/landing/sections/animated-card-grid';
import { BottomCTASection } from '@/components/landing/sections/bottom-cta-section';
import { FAQSection } from '@/components/landing/sections/faq-section';
import type { LandingFAQItem } from '@/components/landing/sections/landing-types';
import {
  cellReveal,
  denseStagger,
  MotionBlockquote,
  MotionDiv,
  MotionP,
  quickTransition,
  subtleFade,
  VIEWPORT_ONCE,
} from '@/components/landing/sections/motion-variants';
import { SectionDivider } from '@/components/landing/sections/section-divider';
import { SectionHeader } from '@/components/landing/sections/section-header';
import { SolutionLinksSection } from '@/components/landing/sections/solution-links';
import { TerminalCard } from '@/components/landing/sections/terminal-card';
import { LandingPageLayout } from '@/components/layouts/landing-page-layout';
import { Badge } from '@/components/ui/badge';
import { BlurFade } from '@/components/ui/blur-fade';
import { Card, CardContent } from '@/components/ui/card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { TextAnimate } from '@/components/ui/text-animate';
import {
  createBreadcrumbListJsonLd,
  createFAQPageJsonLd,
  createSoftwareAppJsonLd,
  serializeJsonLd,
} from '@/lib/seo/json-ld';
import { cn } from '@/lib/ui/cn';

// ============================================================================
// DATA
// ============================================================================

const RESEARCH_STATS = [
  {
    detail: 'Non-expert judges improved from 48% → 76% accuracy when evaluating debated answers vs single-model responses',
    gradientText: 'from-green-400 to-emerald-300',
    metric: 'Accuracy improvement',
    prefix: '+',
    source: 'Khan et al. · UCL + Anthropic · ICML 2024 Best Paper',
    sourceUrl: 'https://arxiv.org/abs/2402.06782',
    suffix: ' percentage points',
    value: 28,
  },
  {
    detail: 'Multi-agent debate improved math reasoning from 67% → 81.8%. Models correct each other through sequential challenge rounds',
    gradientText: 'from-teal-400 to-cyan-300',
    metric: 'Math reasoning boost',
    prefix: '+',
    source: 'Du et al. · MIT + DeepMind · ICML 2024',
    sourceUrl: 'https://arxiv.org/abs/2305.14325',
    suffix: ' percentage points',
    value: 14.8,
  },
  {
    detail: 'Mixture-of-Agents: open-source models collaborating scored 65.1% vs GPT-4 Omni\'s 57.5% — proving collective reasoning beats individual capability',
    gradientText: 'from-violet-400 to-purple-300',
    metric: 'Open-source beats GPT-4',
    prefix: '',
    source: 'Wang et al. · Together AI + Stanford · ICLR 2025',
    sourceUrl: 'https://arxiv.org/abs/2406.04692',
    suffix: '% on AlpacaEval 2.0',
    value: 65.1,
  },
  {
    detail: 'Weak LLM judges supervising strong LLMs via debate outperformed direct questioning on every task tested — scalable oversight works',
    gradientText: 'from-blue-400 to-sky-300',
    label: 'Debate wins on every task',
    metric: 'Universal advantage',
    prefix: '',
    source: 'Kenton et al. · Google DeepMind · NeurIPS 2024',
    sourceUrl: 'https://arxiv.org/abs/2407.04622',
    suffix: '',
    value: null,
  },
] as const;

const RESEARCH_PAPERS = [
  {
    authors: 'Khan et al.',
    badge: 'Best Paper Award',
    badgeColor: 'text-amber-400 border-amber-400/30',
    detail: 'Non-expert judges improved from 48% → 76% accuracy when evaluating debated answers vs single-model responses. Sequential debate where models challenge each other produces more truthful outputs than any single model.',
    title: 'Debating with More Persuasive LLMs Leads to More Truthful Answers',
    url: 'https://arxiv.org/abs/2402.06782',
    venue: 'ICML 2024',
  },
  {
    authors: 'Du et al.',
    badge: 'MIT CSAIL',
    badgeColor: 'text-teal-400 border-teal-400/30',
    detail: 'Multi-agent debate improved mathematical reasoning by +14.8 percentage points (67% → 81.8%). Models correct each other through sequential challenge rounds, actively suppressing uncertain claims.',
    title: 'Improving Factuality and Reasoning in Language Models through Multiagent Debate',
    url: 'https://arxiv.org/abs/2305.14325',
    venue: 'ICML 2024',
  },
  {
    authors: 'Kenton et al.',
    badge: 'Google DeepMind',
    badgeColor: 'text-blue-400 border-blue-400/30',
    detail: 'Weak LLM judges supervising strong LLMs via debate outperformed direct questioning on every task tested. Debate enables scalable oversight even when the judge is less capable than the models being judged.',
    title: 'On Scalable Oversight with Weak LLMs Judging Strong LLMs',
    url: 'https://arxiv.org/abs/2407.04622',
    venue: 'NeurIPS 2024',
  },
  {
    authors: 'Wang et al.',
    badge: 'Together AI + Stanford',
    badgeColor: 'text-violet-400 border-violet-400/30',
    detail: 'Open-source models collaborating via Mixture-of-Agents scored 65.1% on AlpacaEval 2.0 — beating GPT-4 Omni\'s 57.5%. Collective reasoning surpasses individual model capability.',
    title: 'Mixture-of-Agents Enhances Large Language Model Capabilities',
    url: 'https://arxiv.org/abs/2406.04692',
    venue: 'ICLR 2025',
  },
  {
    authors: 'Chan et al.',
    badge: 'Multi-Agent Eval',
    badgeColor: 'text-green-400 border-green-400/30',
    detail: 'Multi-agent debate produces evaluation judgments that correlate more strongly with human preferences than single-model scoring. Debate-based evaluation outperforms single-model grading on every benchmark tested.',
    title: 'ChatEval: Towards Better LLM-based Evaluators through Multi-Agent Debate',
    url: 'https://arxiv.org/abs/2308.07201',
    venue: 'ICLR 2025',
  },
  {
    authors: 'Quanta Magazine',
    badge: 'Editorial',
    badgeColor: 'text-green-400 border-green-400/30',
    detail: '"When AI systems are forced to debate each other, they become more truthful — even when individual models would otherwise confabulate." Coverage of Khan et al. and the broader debate-as-alignment research program.',
    title: 'AI Systems That Argue Are More Honest',
    url: 'https://www.quantamagazine.org/ai-systems-that-argue-are-more-honest-20250327/',
    venue: 'Quanta Magazine',
  },
] as const;

const TRUST_GAP_STATS = [
  { label: 'of knowledge workers use AI at work', prefix: '', source: 'Microsoft Work Trend Index 2024', suffix: '%', value: 75 },
  { label: 'distrust AI accuracy', prefix: '', source: 'Deloitte State of GenAI 2024', suffix: '%', value: 46 },
  { label: 'hallucination cost to enterprises', prefix: '$', source: 'AllAboutAI 2024', suffix: 'B', value: 67.4 },
  { label: 'report inaccurate AI decisions', prefix: '', source: 'McKinsey AI Survey 2024', suffix: '%', value: 47 },
] as const;

const FAQ_ITEMS: readonly LandingFAQItem[] = [
  {
    answer: 'MCP (Model Context Protocol) is an open standard for connecting AI assistants to external tools and data sources. It lets Claude Code, Cursor, and other MCP-compatible clients call DebateKit\'s debate tools directly from your IDE without switching context.',
    question: 'What is MCP?',
  },
  {
    answer: 'Perplexity Council runs models in parallel — they never see each other\'s reasoning. DebateKit uses sequential deliberation: each model reads and challenges previous responses before generating its own. Khan et al. (UCL + Anthropic, ICML 2024 Best Paper) showed this sequential approach improves judge accuracy by +28 percentage points vs parallel generation. The council produces documented reasoning — not just answers.',
    question: 'How is this different from Perplexity Council or other multi-model tools?',
  },
  {
    answer: 'Each model sees all previous responses before crafting its own. GPT-4 can challenge Claude\'s reasoning, and Gemini can synthesize both perspectives. The result is genuine cross-examination — not parallel generation. Validated by UCL and Anthropic research (Khan et al., ICML 2024 Best Paper).',
    question: 'How does the sequential debate work?',
  },
  {
    answer: 'Models from Anthropic, OpenAI, Google, and DeepSeek — including Claude, GPT-4.1, o3, Gemini 2.5, and DeepSeek R1. Use the list_models tool to see the current roster.',
    question: 'What models are available?',
  },
  {
    answer: 'Because they\'d never see each other\'s answers. DebateKit\'s sequential deliberation means Model B reads Model A\'s full response before generating its own — it can agree, challenge, extend, or push back on specific points. The result is an answer that\'s been stress-tested from multiple angles — not a single model\'s best guess.',
    question: 'Why not just prompt three models separately?',
  },
  {
    answer: 'Every DebateKit debate produces a complete decision record: which models participated, what positions they took, and how the council reached its conclusion. This maps directly to EU AI Act Article 12 transparency requirements (enforcement begins August 2, 2026), ISO 42001 AI management system documentation, and FINRA\'s 2024 guidance on AI in securities. For regulated industries, the reasoning trail is the compliance artifact.',
    question: 'How does this help with compliance and auditing?',
  },
  {
    answer: 'No. Any high-stakes decision benefits from multi-model deliberation — architecture reviews, security audits, product strategy, legal analysis, investment research, clinical reasoning. If the stakes are high and the answer isn\'t obvious, you want a council arguing the tradeoffs, not one model guessing.',
    question: 'Is this just for coding decisions?',
  },
  {
    answer: 'Four peer-reviewed papers, three top venues. Khan et al. (UCL + Anthropic, ICML 2024 Best Paper): debate improved judge accuracy by +28 percentage points. Du et al. (MIT + DeepMind, ICML 2024): multi-agent debate boosted math reasoning by +14.8pp (67% → 81.8%). Kenton et al. (Google DeepMind, NeurIPS 2024): debate outperformed direct questioning on every task — even with weaker judges. Wang et al. (Together AI + Stanford, ICLR 2025): open-source models collaborating via Mixture-of-Agents scored 65.1% vs GPT-4 Omni\'s 57.5%. The consistent finding: structured disagreement catches errors that no single model surfaces.',
    question: 'What does the research actually say?',
  },
  {
    answer: 'Not unconditionally. Wang et al. (Together AI + Stanford, ICLR 2025) demonstrated that open-source models collaborating via Mixture-of-Agents outperform GPT-4 Omni — collective reasoning surpasses individual capability. Khan et al. (UCL + Anthropic, ICML 2024 Best Paper) showed a +28 percentage point accuracy improvement when non-expert judges evaluated debated answers. Kenton et al. (Google DeepMind) demonstrated debate works as a scalable oversight mechanism even when models exceed human capability. The consistent finding: structured disagreement catches errors that no single model surfaces on its own.',
    question: 'Does multi-model debate always improve accuracy?',
  },
  {
    answer: 'Every account gets 1 free debate round to try the full experience with up to 3 models. After that, free accounts have hard limits: 15 requests per 5-hour window, 50 per day, and 200 per week. Once you hit any of these limits, MCP tool calls are blocked until the window resets — there is no overage or grace period. Free accounts also have a 60-minute cooldown after hitting the 5-hour limit. Upgrade to Pro ($59/month) for 100 requests per 5 hours, 500 per day, 2,000 per week, no cooldowns, and 2,000,000 monthly credits.',
    question: 'What are the free tier limits?',
  },
  {
    answer: 'When you hit your rate limit, MCP tool calls are immediately blocked — your IDE will receive an error. This is a hard limit, not a soft cap. The error message will tell you when your window resets (5-hour, daily, or weekly). Free users also enter a 60-minute cooldown after exceeding the 5-hour window. To remove all limits and cooldowns, upgrade to Pro.',
    question: 'What happens when I run out of free MCP requests?',
  },
  {
    answer: 'Yes. DebateKit uses a credit system alongside rate limits. Free accounts receive a one-time 5,000 credit signup bonus. Each debate costs credits based on the models used and thinking level. When credits run out, you cannot start new debates even if you are within rate limits. Pro subscribers receive 2,000,000 credits per month that refill automatically.',
    question: 'Do MCP tool calls cost credits?',
  },
] as const;

const TRUST_PILLARS = [
  {
    description: 'Every tool call logged with model attribution and reasoning chain. When the council says \'refactor,\' you can trace which model proposed it, which challenged it, and why the verdict stands.',
    icon: Icons.fileSearch,
    title: 'Full Traceability',
  },
  {
    description: 'MCP runs in your IDE. Code context never leaves your machine. API calls are excluded from model training by every provider we route through.',
    icon: Icons.lock,
    title: 'Your Code Stays Local',
  },
  {
    description: 'AI deliberates. You decide. Every verdict includes the reasoning so you can override with confidence. The council argues the tradeoffs — you make the call.',
    icon: Icons.userCheck,
    title: 'Human-in-the-Loop',
  },
  {
    description: 'Every council produces a decision record — which models participated, what positions they took, how the verdict was reached. The EU AI Act (August 2026) requires exactly this kind of AI decision documentation for high-risk systems.',
    icon: Icons.shieldCheck,
    title: 'Compliance-Ready',
  },
] as const;

// ============================================================================
// S1: HERO — "Kill the Echo Chamber"
// ============================================================================

function HeroSection() {
  const [activeTab, setActiveTab] = useState<(typeof DEMO_SCENARIO_TABS)[number]>('Engineering');
  const posthog = usePostHog();

  const handleScenarioChange = useCallback((tab: (typeof DEMO_SCENARIO_TABS)[number]) => {
    posthog?.capture('mcp_landing_demo_scenario_selected', {
      scenario: tab.toLowerCase(),
    });
    setActiveTab(tab);
  }, [posthog]);

  return (
    <section className="relative overflow-hidden flex items-center justify-center">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(rgba(74, 222, 128, 0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl w-full px-4 sm:px-6 py-14 sm:py-20 md:py-28 text-center overflow-hidden">
        {/* Headline — TextAnimate by word */}
        <div>
          <TextAnimate
            as="h1"
            by="word"
            animation="blurInUp"
            duration={0.8}
            className="font-sans text-3xl font-bold tracking-[-0.03em] text-white leading-[1.08] sm:text-4xl md:text-5xl lg:text-6xl"
            once
          >
            The MCP skill
          </TextAnimate>
          <span className="flex items-baseline justify-center gap-[0.3em] mt-1 flex-wrap">
            <TextAnimate
              as="span"
              by="word"
              animation="blurInUp"
              duration={0.8}
              delay={0.3}
              className="font-sans text-3xl font-bold tracking-[-0.03em] text-white leading-[1.08] sm:text-4xl md:text-5xl lg:text-6xl"
              once
            >
              your AI is
            </TextAnimate>
            <TextAnimate
              as="span"
              by="word"
              animation="blurInUp"
              duration={0.8}
              delay={0.4}
              className="font-sans text-3xl font-bold tracking-[-0.03em] text-green-400 leading-[1.08] sm:text-4xl md:text-5xl lg:text-6xl"
              once
            >
              missing.
            </TextAnimate>
          </span>
        </div>

        {/* Subheadline */}
        <MotionDiv
          className="mx-auto mt-6 max-w-2xl lg:max-w-4xl"
          initial={subtleFade.hidden}
          animate={subtleFade.visible}
          transition={{ ...quickTransition, delay: 0.5 }}
        >
          <p className="text-base text-gray-400 leading-relaxed sm:text-lg md:text-xl">
            Structured debate between multiple AI models that argue the tradeoffs, catch blind spots, and show their reasoning — so every decision gets the full picture.
          </p>
        </MotionDiv>

        {/* Credibility line */}
        <MotionP
          className="mt-4 text-xs text-gray-600"
          initial={subtleFade.hidden}
          animate={subtleFade.visible}
          transition={{ ...quickTransition, delay: 0.6 }}
        >
          Mechanism backed by peer-reviewed research from UCL, Anthropic, MIT, and Google DeepMind
        </MotionP>

        {/* Terminal demo */}
        <div className="mt-8 sm:mt-12">
          {/* Scenario toggle pills */}
          <MotionDiv
            className="flex items-center justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6 flex-wrap px-2 sm:px-0"
            initial={subtleFade.hidden}
            animate={subtleFade.visible}
            transition={{ ...quickTransition, delay: 0.7 }}
          >
            {DEMO_SCENARIO_TABS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => handleScenarioChange(tab)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer',
                  activeTab === tab
                    ? 'bg-green-400/15 text-green-400 border border-green-400/30'
                    : 'text-gray-500 border border-white/[0.06] hover:text-gray-300 hover:border-white/[0.12]',
                )}
              >
                {tab}
              </button>
            ))}
          </MotionDiv>

          {/* Terminal demo */}
          <BlurFade delay={0.2} inView>
            <div className="mx-auto max-w-4xl w-full min-w-0">
              <MCPTerminalDemo scenario={DEMO_SCENARIOS[activeTab]} />
            </div>
          </BlurFade>
        </div>

        {/* Add to your MCP client */}
        <MotionDiv
          className="mt-10 sm:mt-14 mx-auto max-w-4xl w-full min-w-0 text-left"
          initial={subtleFade.hidden}
          animate={subtleFade.visible}
          transition={{ ...quickTransition, delay: 0.9 }}
        >
          <div className="mb-4 sm:mb-5">
            <div className="font-medium text-xs uppercase tracking-[0.15em] text-gray-500 mb-3">
              Install
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-[-0.03em] leading-[1.1] text-white">
              Set up
              {' '}
              <span className="text-green-400">in seconds</span>
            </h2>
          </div>
          <MCPPlatformCodeBlock />
        </MotionDiv>
      </div>
    </section>
  );
}

// ============================================================================
// S3: THE PROBLEM — "Your AI is a Yes-Man"
// ============================================================================

function ProblemSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Problem"
          heading="Your AI is a"
          headingHighlight="yes-man"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Black Box — the problem */}
          <BlurFade delay={0.1} inView>
            <TerminalCard label="single model" labelColor="text-red-400/60">
              <div>
                <span className="text-green-400 select-none">you &rsaquo; </span>
                <span className="text-gray-300">ALTER TABLE users ADD COLUMN last_login TIMESTAMP DEFAULT NOW() — safe for prod?</span>
              </div>
              <div>
                <span className="text-violet-400 select-none">ai&nbsp;&nbsp;&nbsp;&nbsp; </span>
                <span className="text-gray-400">Yes, adding a column with a default is a metadata-only operation. Ship it.</span>
              </div>
              <div className="pt-2 border-t border-red-500/10">
                <span className="text-[10px] uppercase tracking-[0.15em] text-red-400/60">One model. One opinion. You find out Monday it was wrong.</span>
              </div>
            </TerminalCard>
          </BlurFade>

          {/* Right: Glass Box — the answer */}
          <BlurFade delay={0.2} inView>
            <TerminalCard label="council of three" labelColor="text-green-400/60">
              <div>
                <span className="text-green-400 select-none">you &rsaquo; </span>
                <span className="text-gray-300">ALTER TABLE users ADD COLUMN last_login TIMESTAMP DEFAULT NOW() — safe for prod?</span>
              </div>
              <div className="text-gray-500 text-xs pl-3 border-l border-white/[0.06]">
                <span className="text-emerald-400 text-sm font-bold">GPT-4.1</span>
                <span className="text-emerald-400/50 text-xs font-medium"> · DevOps Lead</span>
                <span className="text-gray-400">: Depends on your Postgres version. Pre-11, this rewrites the entire table and holds a write lock. Even on 11+, NOW() is volatile — it still forces a rewrite.</span>
              </div>
              <div className="text-gray-500 text-xs pl-3 border-l border-white/[0.06]">
                <span className="text-blue-400 text-sm font-bold">Gemini</span>
                <span className="text-blue-400/50 text-xs font-medium"> · Database Expert</span>
                <span className="text-gray-400">: Use DEFAULT NULL instead, then backfill in batches. Volatile defaults bypass the metadata-only optimization even on modern Postgres.</span>
              </div>
              <div className="text-gray-500 text-xs pl-3 border-l border-white/[0.06]">
                <span className="text-violet-400 text-sm font-bold">Grok</span>
                <span className="text-violet-400/50 text-xs font-medium"> · Ops Realist</span>
                <span className="text-gray-400">: Both right. Also — it&apos;s Friday afternoon. Schema migrations before the weekend are how you get paged at 2am.</span>
              </div>
              {/* Verdict */}
              <div className="pt-2 border-t border-green-400/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-green-400">Council Verdict</span>
                </div>
                <span className="text-green-400/90 text-xs">Block deploy. Volatile default forces table rewrite regardless of PG version. Safe path: add as nullable, backfill, then set default.</span>
              </div>
            </TerminalCard>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// S3.5: MANIFESTO — Why We Built This
// ============================================================================

function ManifestoSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            label="Why We Built This"
            heading="AI changed everything."
            headingHighlight="Except how we decide."
          />

          <div className="space-y-4 sm:space-y-6 text-sm sm:text-base leading-relaxed">
            <BlurFade delay={0.1} inView>
              <p className="text-gray-400">
                Every team uses AI now. But they use it the same way — ask one model, trust the answer, ship it. For boilerplate, that works. For architecture calls, security reviews, and infrastructure changes, it&apos;s a coin flip with production on the line.
              </p>
            </BlurFade>

            <BlurFade delay={0.15} inView>
              <p className="text-gray-400">
                Worse — models are trained to agree with you. Anthropic&apos;s own research (ICLR 2024) showed that
                LLMs systematically tell users what they want to hear, even when the user is wrong. They call it
                sycophancy. We call it the core failure mode of single-model AI: a system optimized to sound right,
                not to be right.
              </p>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <p className="text-gray-400">
                And 66% of the time, the answer is almost right — close enough to ship, wrong enough to break.
                That&apos;s the danger zone. Not the obvious hallucinations. The confident, plausible, subtly wrong answers
                that pass code review because they sound like something a senior engineer would say.
              </p>
            </BlurFade>

            <BlurFade delay={0.25} inView>
              <p className="text-gray-400">
                The fix isn&apos;t a better model. It&apos;s
                {' '}
                <span className="text-white font-medium">structured disagreement</span>
                .
                When AI is forced to challenge AI — reading, questioning, and stress-testing each
                other&apos;s reasoning — errors surface that no single model catches. This is
                peer-reviewed science presented at ICML, NeurIPS, and ICLR. Not a hypothesis.
              </p>
            </BlurFade>

            <BlurFade delay={0.3} inView>
              <div className="border-l-2 border-white/[0.08] pl-4 sm:pl-5 space-y-2 sm:space-y-3">
                <p className="text-sm font-medium text-white">Who this is for</p>
                <p className="text-sm text-gray-400">
                  Anyone making high-stakes decisions with AI — engineers, product leads, marketers,
                  designers, founders. If the answer matters and one model isn&apos;t enough,
                  you want a council arguing the tradeoffs before you commit.
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.35} inView>
              <div className="border-l-2 border-white/[0.08] pl-4 sm:pl-5 space-y-2 sm:space-y-3">
                <p className="text-sm font-medium text-white">What we&apos;re building</p>
                <p className="text-sm text-gray-400">
                  AI peer review for critical changes. Not a chat UI. Not a copilot. A council that
                  argues the tradeoffs before you ship — with a full reasoning trail for every decision.
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.4} inView>
              <div className="border-l-2 border-green-400/30 pl-5 mt-2">
                <p className="text-sm text-gray-500 italic">
                  We used DebateKit to make this decision. The positioning, the target market, the
                  copy on this page — all debated by a council of models before we committed. We build
                  with what we ship.
                </p>
              </div>
            </BlurFade>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// S6: RESEARCH — Peer-Reviewed Numbers
// ============================================================================

function ResearchSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Research"
          heading="Backed by"
          headingHighlight="peer-reviewed science"
          description="Multi-model debate isn't a hypothesis. It's the mechanism behind the most accurate AI reasoning ever measured."
        />

        <AnimatedCardGrid
          items={RESEARCH_STATS}
          keyExtractor={stat => stat.source}
          renderItem={stat => (
            <Card variant={CardVariants.GLASS_SUBTLE} className="h-full shadow-none border-white/[0.06]">
              <CardContent className="p-4 sm:p-6 flex flex-col h-full">
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-gray-600">
                  {stat.metric}
                </span>

                <div className={cn('mt-2 text-xl sm:text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent', stat.gradientText)}>
                  {stat.value !== null && (
                    <span>
                      {stat.prefix}
                      <NumberTicker
                        value={stat.value}
                        className={cn('text-xl sm:text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent', stat.gradientText)}
                      />
                      {stat.suffix}
                    </span>
                  )}
                  {stat.value === null && 'label' in stat && (
                    <span>{stat.label}</span>
                  )}
                </div>

                <p className="mt-3 text-sm text-gray-400 leading-relaxed flex-1">
                  {stat.detail}
                </p>

                <a
                  href={stat.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 text-xs text-gray-600 italic hover:text-gray-400 transition-colors"
                >
                  {stat.source}
                </a>
              </CardContent>
            </Card>
          )}
        />

        <MotionBlockquote
          className="mt-8 border-l-2 border-green-400/30 pl-5 mx-auto max-w-3xl"
          initial={subtleFade.hidden}
          whileInView={subtleFade.visible}
          viewport={VIEWPORT_ONCE}
          transition={quickTransition}
        >
          <p className="text-sm text-gray-400 italic leading-relaxed">
            &ldquo;Two sets of findings released in 2024 offer the first empirical evidence that debate between two LLMs helps a judge recognize the truth.&rdquo;
          </p>
          <cite className="mt-2 block text-xs text-gray-600 not-italic">
            —
            {' '}
            <a
              href="https://www.quantamagazine.org/ai-systems-that-argue-are-more-honest-20250327/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition-colors"
            >
              Quanta Magazine
            </a>
            , March 2025
          </cite>
        </MotionBlockquote>
      </div>
    </section>
  );
}

// ============================================================================
// PRESETS SHOWCASE
// ============================================================================

function PresetsShowcaseSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <SectionHeader
          label="Inside the Product"
          heading="Presets or"
          headingHighlight="build your own"
          description="Start with a curated council of models and roles — or pick exactly which models debate and what perspective each one takes."
        />
        <BlurFade delay={0.1} inView className="mt-12">
          <LandingBrowserFrame>
            <MCPConfigDemo />
          </LandingBrowserFrame>
        </BlurFade>
      </div>
    </section>
  );
}

// ============================================================================
// S9: TRUST & SECURITY
// ============================================================================

function TrustSecuritySection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Trust & Security"
          heading="Built for"
          headingHighlight="high-stakes decisions"
          description="DebateKit is designed for confidential, critical work — code reviews, architecture calls, security audits."
        />

        <AnimatedCardGrid
          items={TRUST_PILLARS}
          keyExtractor={item => item.title}
          renderItem={item => (
            <Card variant={CardVariants.GLASS_SUBTLE} className="h-full shadow-none border-white/[0.06]">
              <CardContent className="pt-6">
                <item.icon className="size-8 text-green-400/70 mb-4" />
                <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.description}</p>
              </CardContent>
            </Card>
          )}
        />
      </div>
    </section>
  );
}

// ============================================================================
// S6.5: RESEARCH PAPERS — Deep Dive
// ============================================================================

function ResearchPaperCard({ paper }: { paper: (typeof RESEARCH_PAPERS)[number] }) {
  return (
    <a
      href={paper.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full"
    >
      <Card variant={CardVariants.GLASS_SUBTLE} className="h-full group shadow-none border-white/[0.06]">
        <CardContent className="p-4 sm:p-5 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant="outline" className={cn('text-[10px] uppercase tracking-[0.12em]', paper.badgeColor)}>
              {paper.venue}
            </Badge>
            {paper.badge && (
              <Badge variant="outline" className={cn('text-[10px] uppercase tracking-[0.12em]', paper.badgeColor)}>
                {paper.badge}
              </Badge>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white mb-2 leading-snug group-hover:text-green-400/90 transition-colors">
            {paper.title}
          </h3>
          <p className="text-xs text-gray-500 mb-2">{paper.authors}</p>
          <p className="text-xs text-gray-400 leading-relaxed flex-1">
            {paper.detail}
          </p>
          <div className="mt-3 flex items-center gap-1 text-xs text-gray-600 group-hover:text-gray-400 transition-colors">
            <span>
              {'Read '}
              {paper.venue === 'Quanta Magazine' ? 'article' : 'paper'}
            </span>
            <Icons.arrowRight className="size-3" />
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

function ResearchPapersSection() {
  return (
    <section id="research" className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Deep Dive"
          heading="Read the"
          headingHighlight="research"
          description="The peer-reviewed papers behind multi-model deliberation — from UCL, Anthropic, Google DeepMind, MIT, and leading AI labs."
        />

        <AnimatedCardGrid
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          items={RESEARCH_PAPERS}
          keyExtractor={paper => paper.title}
          renderItem={paper => <ResearchPaperCard paper={paper} />}
        />
      </div>
    </section>
  );
}

// ============================================================================
// JSON-LD DATA
// ============================================================================

function JsonLdScripts() {
  const appJsonLd = createSoftwareAppJsonLd();

  const faqJsonLd = createFAQPageJsonLd(
    FAQ_ITEMS.map(f => ({ answer: f.answer, question: f.question })),
  );

  const breadcrumbJsonLd = createBreadcrumbListJsonLd([
    { name: 'Home', path: '/' },
    { name: 'MCP Server', path: '/mcp' },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(appJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
    </>
  );
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function MCPLandingScreen() {
  const posthog = usePostHog();

  const handleCtaClick = useCallback((ctaLabel: string, section: string) => {
    posthog?.capture('mcp_landing_cta_clicked', { cta_label: ctaLabel, section });
  }, [posthog]);

  return (
    <LandingPageLayout>
      <JsonLdScripts />
      <HeroSection />
      {/* Trust gap stats */}
      <section className="py-12 sm:py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <MotionDiv
            className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6"
            initial={denseStagger.hidden}
            whileInView={denseStagger.visible}
            viewport={VIEWPORT_ONCE}
          >
            {TRUST_GAP_STATS.map((stat, i) => (
              <MotionDiv
                key={stat.label}
                className="text-center p-2 sm:p-4"
                initial={cellReveal.hidden}
                whileInView={cellReveal.visible}
                viewport={VIEWPORT_ONCE}
                transition={{ ...quickTransition, delay: i * 0.06 }}
              >
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                  {stat.prefix}
                  <NumberTicker value={stat.value} className="text-2xl sm:text-3xl md:text-4xl font-bold text-white" />
                  {stat.suffix}
                </div>
                <p className="text-xs sm:text-sm text-gray-400 mt-1.5 sm:mt-2">{stat.label}</p>
                <p className="text-[10px] sm:text-xs text-gray-600 mt-1 italic hidden sm:block">{stat.source}</p>
              </MotionDiv>
            ))}
          </MotionDiv>
        </div>
      </section>
      <SectionDivider />
      <ProblemSection />
      <SectionDivider />
      <ResearchSection />
      <SectionDivider />
      <ManifestoSection />
      <SectionDivider />
      <PresetsShowcaseSection />
      <SectionDivider />
      <TrustSecuritySection />
      <SectionDivider />
      <ResearchPapersSection />
      <SectionDivider />
      <SolutionLinksSection currentPath="/mcp" />
      <SectionDivider />
      <FAQSection items={FAQ_ITEMS} variant="minimal">
        {/* Final CTA after FAQ */}
        <BottomCTASection
          heading="30 Seconds to Your First Verdict"
          description="Pick your MCP client, add the server, and start your first council debate."
          ctaText="Get Your API Key"
          onCtaClick={() => handleCtaClick('Get Your API Key', 'bottom_cta')}
        >
          <div className="mb-8 text-left min-w-0 w-full">
            <MCPPlatformCodeBlock />
          </div>
        </BottomCTASection>
      </FAQSection>
    </LandingPageLayout>
  );
}
