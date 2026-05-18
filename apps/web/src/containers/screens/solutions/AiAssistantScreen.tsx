'use client';

import { CardVariants } from '@debatekit/shared';
import { Link } from '@tanstack/react-router';
import { useCallback, useState } from 'react';

import { Icons } from '@/components/icons';
import { AiAssistantHeroDemo } from '@/components/landing/ai-assistant-hero-demo';
import { CHAT_DEMO_SCENARIOS, DEMO_SCENARIO_TABS } from '@/components/landing/data/chat-demo-scenarios';
import { LandingBrowserFrame } from '@/components/landing/landing-browser-frame';
import { MCPConfigDemo } from '@/components/landing/mcp-config-demo';
import { AnimatedCardGrid } from '@/components/landing/sections/animated-card-grid';
import { BottomCTASection } from '@/components/landing/sections/bottom-cta-section';
import { FAQSection } from '@/components/landing/sections/faq-section';
import { FeatureCardGridSection } from '@/components/landing/sections/feature-card-grid-section';
import type { LandingFAQItem, LandingFeatureCard } from '@/components/landing/sections/landing-types';
import {
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
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { NumberTicker } from '@/components/ui/number-ticker';
import { TextAnimate } from '@/components/ui/text-animate';
import {
  createBreadcrumbListJsonLd,
  createFAQPageJsonLd,
  createProductJsonLd,
  serializeJsonLd,
} from '@/lib/seo/json-ld';
import { cn } from '@/lib/ui/cn';

// ============================================================================
// FAQ DATA
// ============================================================================

const FAQ_ITEMS: readonly LandingFAQItem[] = [
  {
    answer:
      'DebateKit is an AI assistant that queries multiple AI models on the same question. Instead of getting one model\'s opinion, you get a structured debate \u2014 models argue the tradeoffs, challenge each other\'s reasoning, and a moderator synthesizes the verdict. It\'s like having a board of advisors instead of a single consultant.',
    question: 'What is an AI assistant that uses multiple models?',
  },
  {
    answer:
      'ChatGPT, Grok, and other AI tools give you one model\'s answer. DebateKit gives you the debate between models. When GPT-4 says "ship it" and Claude says "wait \u2014 there\'s a security gap," you get both perspectives plus a synthesis. Single-model tools optimize for sounding right. Multi-model debate optimizes for being right.',
    question: 'How is this different from ChatGPT, Grok AI, or other AI tools?',
  },
  {
    answer:
      'An LLM council is a setup where multiple large language models are queried on the same question and their responses are compared or deliberated. The concept was popularized by Andrej Karpathy. DebateKit turns this concept into a production tool with sequential deliberation, structured modes, role-based personas, and moderator synthesis.',
    question: 'What is an LLM council?',
  },
  {
    answer:
      'Model diversity matters more than model quality \u2014 that\'s the key AI trend in 2026. Research from ICML 2024 (Best Paper) showed that multi-model debate improves accuracy by +28 percentage points. The industry is shifting from "which is the best model?" to "how do we combine models for better decisions?"',
    question: 'What AI trends in 2026 make multi-model debate important?',
  },
  {
    answer:
      'No. DebateKit is the opposite of a blackbox. Every council produces a full decision record \u2014 which models participated, what positions they took, where they agreed, where they disagreed, and how the verdict was reached. You see the reasoning, not just the answer.',
    question: 'Is this a blackbox AI system?',
  },
  {
    answer:
      'For productivity, the most impactful AI tool isn\'t the one that answers fastest \u2014 it\'s the one that answers best. DebateKit catches errors, surfaces tradeoffs, and eliminates the back-and-forth of asking multiple tools separately. Teams use it for architecture decisions, content strategy, investment analysis, and any decision where the stakes justify more than one opinion.',
    question: 'What are the best AI tools for productivity in 2026?',
  },
  {
    answer:
      'Yes. DebateKit works as an everyday AI helper for any decision with genuine tradeoffs. Ask it to review a plan, debate a strategy, challenge an assumption, or brainstorm alternatives. If the question has a clear factual answer, use any single model. If it involves judgment, use the council.',
    question: 'Can I use this as an AI helper for everyday decisions?',
  },
  {
    answer:
      'When models must defend positions against adversarial challenge, confirmation bias collapses. Cross-verification catches hallucinations. Structured disagreement surfaces edge cases. Khan et al. (ICML 2024 Best Paper) measured +28 percentage points accuracy improvement. Wang et al. (ICLR 2025) showed open-source models collaborating outperform GPT-4o acting alone.',
    question: 'How does multi-model debate improve AI accuracy?',
  },
  {
    answer:
      'Yes. DebateKit\'s MCP server integrates with Claude Code, Cursor, Windsurf, and any MCP-compatible client. Run council deliberations without leaving your editor.',
    question: 'Can I run this in my IDE?',
  },
  {
    answer:
      'Your data stays private. All traffic is encrypted via HTTPS and our infrastructure runs on Cloudflare\'s global network. API endpoints are contractually excluded from model training. Every council session produces a traceable decision record \u2014 the EU AI Act (August 2026) requires exactly this kind of documentation for high-risk AI systems.',
    question: 'Is my data secure?',
  },
] as const;

// ============================================================================
// RESEARCH STATS (MCP-style AnimatedCardGrid)
// ============================================================================

const RESEARCH_STATS = [
  {
    detail: 'Non-expert judges improved from 48% \u2192 76% accuracy when evaluating debated answers vs single-model responses',
    gradientText: 'from-green-400 to-emerald-300',
    metric: 'Accuracy improvement',
    prefix: '+',
    source: 'Khan et al. \u00B7 UCL + Anthropic \u00B7 ICML 2024 Best Paper',
    sourceUrl: 'https://arxiv.org/abs/2402.06782',
    suffix: ' percentage points',
    value: 28,
  },
  {
    detail: 'Multi-agent debate improved math reasoning from 67% \u2192 81.8%. Models correct each other through sequential challenge rounds',
    gradientText: 'from-teal-400 to-cyan-300',
    metric: 'Math reasoning boost',
    prefix: '+',
    source: 'Du et al. \u00B7 MIT + DeepMind \u00B7 ICML 2024',
    sourceUrl: 'https://arxiv.org/abs/2305.14325',
    suffix: ' percentage points',
    value: 14.8,
  },
  {
    detail: 'Mixture-of-Agents: open-source models collaborating scored 65.1% vs GPT-4 Omni\'s 57.5% \u2014 proving collective reasoning beats individual capability',
    gradientText: 'from-violet-400 to-purple-300',
    metric: 'Open-source beats GPT-4',
    prefix: '',
    source: 'Wang et al. \u00B7 Together AI + Stanford \u00B7 ICLR 2025',
    sourceUrl: 'https://arxiv.org/abs/2406.04692',
    suffix: '% on AlpacaEval 2.0',
    value: 65.1,
  },
  {
    detail: 'Weak LLM judges supervising strong LLMs via debate outperformed direct questioning on every task tested \u2014 scalable oversight works',
    gradientText: 'from-blue-400 to-sky-300',
    label: 'Debate wins on every task',
    metric: 'Universal advantage',
    prefix: '',
    source: 'Kenton et al. \u00B7 Google DeepMind \u00B7 NeurIPS 2024',
    sourceUrl: 'https://arxiv.org/abs/2407.04622',
    suffix: '',
    value: null,
  },
] as const;

// ============================================================================
// RESEARCH PAPERS (Deep Dive — from MCP page)
// ============================================================================

const RESEARCH_PAPERS = [
  {
    authors: 'Khan et al.',
    badge: 'Best Paper Award',
    badgeColor: 'text-amber-400 border-amber-400/30',
    detail: 'Non-expert judges improved from 48% \u2192 76% accuracy when evaluating debated answers vs single-model responses. Sequential debate where models challenge each other produces more truthful outputs than any single model.',
    title: 'Debating with More Persuasive LLMs Leads to More Truthful Answers',
    url: 'https://arxiv.org/abs/2402.06782',
    venue: 'ICML 2024',
  },
  {
    authors: 'Du et al.',
    badge: 'MIT CSAIL',
    badgeColor: 'text-teal-400 border-teal-400/30',
    detail: 'Multi-agent debate improved mathematical reasoning by +14.8 percentage points (67% \u2192 81.8%). Models correct each other through sequential challenge rounds, actively suppressing uncertain claims.',
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
    detail: 'Open-source models collaborating via Mixture-of-Agents scored 65.1% on AlpacaEval 2.0 \u2014 beating GPT-4 Omni\'s 57.5%. Collective reasoning surpasses individual model capability.',
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
    detail: '\u201CWhen AI systems are forced to debate each other, they become more truthful \u2014 even when individual models would otherwise confabulate.\u201D Coverage of Khan et al. and the broader debate-as-alignment research program.',
    title: 'AI Systems That Argue Are More Honest',
    url: 'https://www.quantamagazine.org/ai-systems-that-argue-are-more-honest-20250327/',
    venue: 'Quanta Magazine',
  },
] as const;

// ============================================================================
// TRUST PILLARS (replaced Compliance-Ready with MCP/IDE integration)
// ============================================================================

const TRUST_PILLARS: readonly LandingFeatureCard[] = [
  {
    color: 'text-green-400/70',
    description: 'Every tool call logged with model attribution and reasoning chain. When the council says "refactor," you can trace which model proposed it, which challenged it, and why the verdict stands.',
    icon: Icons.fileSearch,
    title: 'Full Traceability',
  },
  {
    color: 'text-green-400/70',
    description: 'API calls are excluded from model training by every provider we route through. Your data stays private and encrypted via HTTPS on Cloudflare\'s global network.',
    icon: Icons.lock,
    title: 'Your Data Stays Private',
  },
  {
    color: 'text-green-400/70',
    description: 'AI deliberates. You decide. Every verdict includes the reasoning so you can override with confidence. The council argues the tradeoffs \u2014 you make the call.',
    icon: Icons.userCheck,
    title: 'Human-in-the-Loop',
  },
  {
    color: 'text-green-400/70',
    description: 'Run council deliberations directly in Claude Code, Cursor, Windsurf, or any MCP-compatible IDE. No context switching \u2014 debate where you build.',
    icon: Icons.terminal,
    title: 'Works in Your IDE',
  },
];

// ============================================================================
// HERO SECTION
// ============================================================================

function HeroSection() {
  const [activeTab, setActiveTab] = useState<(typeof DEMO_SCENARIO_TABS)[number]>('Engineering');

  const handleScenarioChange = useCallback((tab: (typeof DEMO_SCENARIO_TABS)[number]) => {
    setActiveTab(tab);
  }, []);

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
        <div>
          <Badge variant="glass" className="mb-6">
            <Icons.sparkles className="size-3" />
            Multi-Model AI Council
          </Badge>
        </div>

        <TextAnimate
          as="h1"
          by="word"
          animation="blurInUp"
          duration={0.8}
          className="font-sans text-3xl font-bold tracking-[-0.03em] text-white leading-[1.08] sm:text-4xl md:text-5xl lg:text-6xl"
          once
        >
          Model diversity matters more
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
            than model
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
            quality.
          </TextAnimate>
        </span>

        <MotionDiv
          className="mx-auto mt-6 max-w-2xl lg:max-w-4xl"
          initial={subtleFade.hidden}
          animate={subtleFade.visible}
          transition={{ ...quickTransition, delay: 0.5 }}
        >
          <p className="text-base text-gray-400 leading-relaxed sm:text-lg md:text-xl">
            Three different models debating beats three instances of the best model. The adversarial pressure is the feature. The moderator finds where they agree, where they disagree, and why.
          </p>
        </MotionDiv>

        <MotionP
          className="mt-4 text-xs text-gray-600"
          initial={subtleFade.hidden}
          animate={subtleFade.visible}
          transition={{ ...quickTransition, delay: 0.6 }}
        >
          Validated at ICML 2024 (Best Paper), NeurIPS 2024, and ICLR 2025
        </MotionP>

        {/* CTA */}
        <MotionDiv
          className="mt-8 flex justify-center"
          initial={subtleFade.hidden}
          animate={subtleFade.visible}
          transition={{ ...quickTransition, delay: 0.65 }}
        >
          <HoverBorderGradient
            as="a"
            containerClassName="mx-auto"
            className="flex items-center gap-2 px-6 py-2.5 text-base font-medium"
            href="/auth/sign-in"
          >
            Try It Free
            <Icons.arrowRight className="size-4" />
          </HoverBorderGradient>
        </MotionDiv>

        {/* Tabbed chat demo */}
        <div className="mt-8 sm:mt-12">
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

          <BlurFade delay={0.2} inView className="max-w-5xl mx-auto">
            <LandingBrowserFrame>
              <AiAssistantHeroDemo key={activeTab} scenario={CHAT_DEMO_SCENARIOS[activeTab]} />
            </LandingBrowserFrame>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// CORE CLAIM SECTION — "Your AI is a yes-man"
// ============================================================================

function CoreClaimSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Problem"
          heading="Your AI is a"
          headingHighlight="yes-man"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BlurFade delay={0.1} inView>
            <TerminalCard label="single model" labelColor="text-red-400/60">
              <div>
                <span className="text-green-400 select-none">you &rsaquo; </span>
                <span className="text-gray-300">Should we launch the campaign next week? Budget is tight but competitors are moving.</span>
              </div>
              <div>
                <span className="text-violet-400 select-none">ai&nbsp;&nbsp;&nbsp;&nbsp; </span>
                <span className="text-gray-400">Yes, moving quickly is important in competitive markets. I&apos;d recommend launching next week to maintain momentum.</span>
              </div>
              <div className="pt-2 border-t border-red-500/10">
                <span className="text-[10px] uppercase tracking-[0.15em] text-red-400/60">One model. One opinion. It agreed with you because it&apos;s trained to.</span>
              </div>
            </TerminalCard>
          </BlurFade>

          <BlurFade delay={0.2} inView>
            <TerminalCard label="council of three" labelColor="text-green-400/60">
              <div>
                <span className="text-green-400 select-none">you &rsaquo; </span>
                <span className="text-gray-300">Should we launch the campaign next week? Budget is tight but competitors are moving.</span>
              </div>
              <div className="text-gray-500 text-xs pl-3 border-l border-white/[0.06]">
                <span className="text-emerald-400 text-sm font-bold">GPT-4.1</span>
                <span className="text-emerald-400/50 text-xs font-medium"> &middot; Growth</span>
                <span className="text-gray-400">: Launch, but cut scope. Run a single-channel test with 30% of budget. If CPA hits target in 72 hours, scale.</span>
              </div>
              <div className="text-gray-500 text-xs pl-3 border-l border-white/[0.06]">
                <span className="text-blue-400 text-sm font-bold">Claude</span>
                <span className="text-blue-400/50 text-xs font-medium"> &middot; Finance</span>
                <span className="text-gray-400">: Tight budget + rushed timeline = uncontrolled spend. Competitors moving isn&apos;t a reason to move poorly. Delay one week, fix attribution first.</span>
              </div>
              <div className="text-gray-500 text-xs pl-3 border-l border-white/[0.06]">
                <span className="text-violet-400 text-sm font-bold">Gemini</span>
                <span className="text-violet-400/50 text-xs font-medium"> &middot; Strategy</span>
                <span className="text-gray-400">: The real question isn&apos;t when to launch &mdash; it&apos;s whether you can measure what matters. Without attribution, any launch date is a guess.</span>
              </div>
              <div className="pt-2 border-t border-green-400/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-green-400">Council Verdict</span>
                </div>
                <span className="text-green-400/90 text-xs">Delay one week. Fix attribution, then launch a single-channel test at 30% budget. The urgency is real but launching blind wastes the budget you can&apos;t afford to waste.</span>
              </div>
            </TerminalCard>
          </BlurFade>
        </div>

        {/* MCP CTA */}
        <BlurFade delay={0.3} inView className="mt-6">
          <Link to="/mcp" className="block group">
            <Card variant={CardVariants.GLASS_SUBTLE} className="!rounded-xl !border-white/[0.08] !bg-white/[0.03] hover:!border-white/[0.12] hover:!bg-white/[0.05] transition-colors">
              <CardContent className="p-3.5 sm:p-4 flex items-center gap-3">
                <Icons.terminal className="size-4 text-green-400/60 shrink-0" />
                <p className="text-sm text-gray-400 flex-1">
                  Run council deliberations in
                  {' '}
                  <span className="text-white font-medium">Claude Code</span>
                  ,
                  {' '}
                  <span className="text-white font-medium">Cursor</span>
                  , or
                  {' '}
                  <span className="text-white font-medium">Windsurf</span>
                  {' '}
                  via MCP
                </p>
                <span className="flex items-center gap-1.5 text-sm text-gray-500 group-hover:text-gray-300 transition-colors shrink-0">
                  Learn more
                  <Icons.arrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        </BlurFade>
      </div>
    </section>
  );
}

// ============================================================================
// PRESETS SHOWCASE SECTION (MCP-style — MCPConfigDemo in browser frame)
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
// RESEARCH SECTION (MCP-style AnimatedCardGrid + blockquote)
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
            &mdash;
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
// RESEARCH PAPERS SECTION (Deep Dive)
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
// TRUST & SECURITY SECTION
// ============================================================================

function TrustSecuritySection() {
  return (
    <FeatureCardGridSection
      columns={2}
      label="Trust & Security"
      heading="Built for"
      headingHighlight="High-Stakes Decisions"
      description="DebateKit is designed for confidential, critical work — with full traceability, data privacy, and IDE integration."
      items={TRUST_PILLARS}
    />
  );
}

// ============================================================================
// JSON-LD DATA
// ============================================================================

function JsonLdScripts() {
  const productJsonLd = createProductJsonLd({
    description:
      'AI assistant powered by multi-model debate. Multiple AI models deliberate, challenge, and synthesize answers for better decisions. Research-validated at ICML 2024, built for engineers, product teams, marketers, analysts, and anyone making high-stakes decisions.',
    name: 'DebateKit AI Assistant',
    path: '/solutions/ai-council',
    price: 0,
  });

  const faqJsonLd = createFAQPageJsonLd(
    FAQ_ITEMS.map(f => ({ answer: f.answer, question: f.question })),
  );

  const breadcrumbJsonLd = createBreadcrumbListJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Solutions', path: '/solutions/ai-council' },
    { name: 'AI Council', path: '/solutions/ai-council' },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
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

export default function AiAssistantScreen() {
  return (
    <LandingPageLayout>
      <JsonLdScripts />
      <HeroSection />
      <SectionDivider />
      <CoreClaimSection />
      <SectionDivider />
      <PresetsShowcaseSection />
      <SectionDivider />
      <ResearchSection />
      <SectionDivider />
      <ResearchPapersSection />
      <SectionDivider />
      <TrustSecuritySection />
      <SectionDivider />
      <SolutionLinksSection currentPath="/solutions/ai-council" />
      <SectionDivider />
      <FAQSection items={FAQ_ITEMS} variant="minimal">
        <BottomCTASection
          heading="Your AI Council Is Ready"
          description="Stop asking one model and hoping it's right. Assemble a council, start the debate."
          ctaText="Get Started Free"
        />
      </FAQSection>
    </LandingPageLayout>
  );
}
