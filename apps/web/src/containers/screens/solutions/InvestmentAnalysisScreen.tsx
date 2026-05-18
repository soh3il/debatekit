'use client';

import { CardVariants } from '@debatekit/shared';

import { Icons } from '@/components/icons';
import { InvestmentConfigDemo } from '@/components/landing/investment-config-demo';
import { InvestmentHeroDemo } from '@/components/landing/investment-hero-demo';
import { LandingBrowserFrame } from '@/components/landing/landing-browser-frame';
import { BottomCTASection } from '@/components/landing/sections/bottom-cta-section';
import { FAQSection } from '@/components/landing/sections/faq-section';
import { LANDING_MODES } from '@/components/landing/sections/landing-modes';
import type { LandingFailure, LandingFAQItem, LandingPersona, LandingRole, MarketStat } from '@/components/landing/sections/landing-types';
import {
  cellReveal,
  denseStagger,
  MotionDiv,
  MotionSpan,
  quickTransition,
  subtleFade,
  VIEWPORT_ONCE,
} from '@/components/landing/sections/motion-variants';
import { ResearchFoundationCallout } from '@/components/landing/sections/research-foundation-callout';
import { SectionDivider } from '@/components/landing/sections/section-divider';
import { SectionHeader } from '@/components/landing/sections/section-header';
import { SolutionLinksSection } from '@/components/landing/sections/solution-links';
import { LandingPageLayout } from '@/components/layouts/landing-page-layout';
import { Badge } from '@/components/ui/badge';
import { BlurFade } from '@/components/ui/blur-fade';
import { Card, CardContent } from '@/components/ui/card';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { NumberTicker } from '@/components/ui/number-ticker';
import { TextAnimate } from '@/components/ui/text-animate';
import {
  createBreadcrumbListJsonLd,
  createFAQPageJsonLd,
  createProductJsonLd,
  serializeJsonLd,
} from '@/lib/seo/json-ld';

// ============================================================================
// FAQ DATA (feeds UI + JSON-LD)
// ============================================================================

const FAQ_ITEMS: readonly LandingFAQItem[] = [
  {
    answer: 'DebateKit is an AI peer review platform. You pick multiple AI models (Claude, GPT-4, Gemini, Grok, and more), assign each one a role, and choose a deliberation mode \u2014 Debating, Analyzing, Brainstorming, or Problem Solving. Each model sees and challenges the others\' outputs, and a Council Moderator synthesizes the verdict at the end.',
    question: 'What is DebateKit?',
  },
  {
    answer: 'Instead of one model producing a single narrative, multiple models argue the bull case and bear case simultaneously \u2014 then a Macro Strategist and Valuation Expert add context. Cross-examination between models catches confirmation bias and hallucinated figures that a single model would miss. When the Bull Case Analyst cites revenue acceleration, the Bear Case Analyst can challenge the sustainability of that growth.',
    question: 'How does multi-model AI improve investment analysis?',
  },
  {
    answer: 'Claude, GPT-4, Gemini, Grok, DeepSeek, and more. You choose which models sit at your investment committee and what role each plays. Roles are fully configurable \u2014 assign "Bull Case Analyst" to Claude, "Bear Case Analyst" to GPT-4, or any combination that fits your research workflow.',
    question: 'Which AI models does DebateKit use?',
  },
  {
    answer: 'DebateKit augments your research team, it does not replace it. The platform handles the information processing \u2014 reading filings, analyzing transcripts, cross-referencing data, and structuring memos \u2014 so your analysts can focus on judgment calls, thesis refinement, and investment committee preparation. Think of it as giving every analyst an AI-powered research team that works in minutes, not days.',
    question: 'Can DebateKit replace my investment analysts?',
  },
  {
    answer: 'A typical investment analysis produces a structured memo with bull/bear cases, macro context, and valuation framework in approximately 15 minutes. This includes earnings call analysis, comparable company context, risk assessment, and conviction scoring. The manual equivalent \u2014 gathering filings, reading transcripts, building models, and writing the memo \u2014 typically takes 2-5 days of analyst time.',
    question: 'How long does it take to analyze an investment?',
  },
  {
    answer: 'Your data stays private. All traffic is encrypted via HTTPS and our infrastructure runs on Cloudflare\'s global network. We route through API endpoints that are contractually excluded from model training by our providers. Research and uploads are isolated per-workspace and never shared across accounts.',
    question: 'Is my data secure?',
  },
  {
    answer: 'Absolutely. Investment analysis is one use case. Teams use the same platform for M&A deal screening, strategic planning, legal analysis, product decisions, competitive research \u2014 any question that deserves more than one perspective. The multi-model deliberation works wherever rigorous analysis matters.',
    question: 'Can I use DebateKit for things other than investment analysis?',
  },
  {
    answer: 'AI addresses the analyst bottleneck during earnings season \u2014 the 6-week window where 500+ companies report and teams struggle to cover their full universe. With multi-model AI, each company gets a structured memo in approximately 15 minutes instead of 2-3 hours of analyst time. This means full portfolio coverage, no analyst fatigue, and faster identification of estimate revision opportunities.',
    question: 'How does AI improve earnings season workflow?',
  },
  {
    answer: 'Yes. Upload earnings call transcripts and DebateKit\'s AI models analyze them from multiple angles simultaneously \u2014 bull case, bear case, macro context, and valuation implications \u2014 then debate their findings. The result is a structured investment memo with citations, not a generic summary. Each insight links to the model that produced it and the reasoning behind it.',
    question: 'Can DebateKit analyze earnings calls automatically?',
  },
  {
    answer: 'DebateKit generates structured investment memos that serve as the foundation for IC presentations. Each memo includes bull/bear cases with conviction scores, macro sensitivity analysis, valuation framework with comparables, and risk factors \u2014 organized into sections that map directly to investment committee format. Your team reviews, refines, and adds judgment.',
    question: 'Does DebateKit generate investment memos?',
  },
  {
    answer: 'Different tools for different workflows. AlphaSense and Tegus provide search and access to filings and expert transcripts. Koyfin and Bloomberg provide financial data and charting. DebateKit sits on top: the analysis layer where you turn raw data into investment decisions. These tools help you find information \u2014 DebateKit helps you think about it from multiple perspectives. Data Access \u2192 Multi-Perspective Analysis (DebateKit) \u2192 Investment Decision.',
    question: 'How is DebateKit different from AlphaSense, Koyfin, or Bloomberg?',
  },
] as const;

// ============================================================================
// ROLE DATA
// ============================================================================

const ROLES: readonly LandingRole[] = [
  {
    color: 'text-emerald-400',
    description: 'Growth drivers, competitive advantages, upside scenarios, and catalysts for outperformance.',
    icon: Icons.trendingUp,
    model: 'Claude',
    title: 'Bull Case Analyst',
  },
  {
    color: 'text-red-400',
    description: 'Risks, competitive threats, downside scenarios, and thesis-breaking assumptions.',
    icon: Icons.shieldAlert,
    model: 'GPT-4',
    title: 'Bear Case Analyst',
  },
  {
    color: 'text-blue-400',
    description: 'Industry trends, regulatory environment, macro sensitivity, and sector positioning.',
    icon: Icons.globe,
    model: 'Gemini',
    title: 'Macro Strategist',
  },
  {
    color: 'text-purple-400',
    description: 'Comparable analysis, DCF modeling, historical multiples, and implied growth expectations.',
    icon: Icons.target,
    model: 'Grok',
    title: 'Valuation Expert',
  },
];

// ============================================================================
// PERSONA DATA
// ============================================================================

const PERSONAS: readonly LandingPersona[] = [
  {
    color: 'text-emerald-400',
    description: 'Evaluate 50+ companies during earnings season. By week three, coverage gaps appear and outliers get missed.',
    icon: Icons.trendingUp,
    painPoint: 'Earnings season coverage overload',
    title: 'Equity Research Analysts',
  },
  {
    color: 'text-blue-400',
    description: 'Evaluate hundreds of startups per year. Thesis validation requires deep market analysis for each.',
    icon: Icons.lightbulb,
    painPoint: 'Deal volume vs. diligence depth',
    title: 'VC Partners & Associates',
  },
  {
    color: 'text-purple-400',
    description: 'Manage diversified portfolios across asset classes. Need consistent analytical rigor across every holding.',
    icon: Icons.briefcase,
    painPoint: 'Cross-asset coverage bandwidth',
    title: 'Family Office CIOs',
  },
  {
    color: 'text-amber-400',
    description: 'Build institutional-quality research for clients. Speed to insight determines competitive advantage.',
    icon: Icons.target,
    painPoint: 'Research speed vs. analytical depth',
    title: 'Institutional Asset Managers',
  },
];

// ============================================================================
// SINGLE-MODEL FAILURE DATA
// ============================================================================

const SINGLE_MODEL_FAILURES: readonly LandingFailure[] = [
  {
    description: 'Research confirms LLMs exhibit strong confirmation bias \u2014 clinging to initial judgments despite counter-evidence. One model can\'t genuinely argue against its own thesis. Investment decisions need adversarial testing, not agreement.',
    icon: Icons.brain,
    number: '01',
    title: 'Built-in Confirmation Bias',
  },
  {
    description: 'A hallucinated EBITDA figure or fabricated guidance number doesn\'t just waste time \u2014 it creates real liability when it reaches the investment committee. Single models lack the cross-checking guardrails financial analysis demands.',
    icon: Icons.alertTriangle,
    number: '02',
    title: 'Hallucination on Financial Data',
  },
  {
    description: 'Investment analysis requires synthesizing filings, transcripts, market data, and analyst estimates simultaneously. A single model produces one coherent narrative \u2014 but misses the tensions between bull and bear that matter most.',
    icon: Icons.layers,
    number: '03',
    title: 'Single-Narrative Blindness',
  },
];

// ============================================================================
// MARKET STATS DATA
// ============================================================================

const MARKET_STATS: readonly MarketStat[] = [
  {
    label: 'of PE firms incorporate AI into their investment process',
    source: 'FTI Consulting, 2024',
    stat: '75%',
  },
  {
    label: 'productivity lift from AI portfolio manager copilots',
    source: 'McKinsey estimate',
    stat: '25-40%',
  },
  {
    label: 'of financial institutions using AI at scale by late 2025',
    source: 'Nvidia State of AI in Financial Services',
    stat: '70%',
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/** Parse a stat string. Returns the numeric value if it's a single number, null if it's a range. */
function parseSingleNumber(stat: string): number | null {
  const match = stat.match(/^(\d+)%$/);
  return match ? Number(match[1]) : null;
}

// ============================================================================
// SECTION COMPONENTS
// ============================================================================

function HeroSection() {
  return (
    <section className="relative py-12 sm:py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
        <div>
          <Badge variant="glass" className="mb-6">
            <Icons.sparkles className="size-3" />
            Your AI Investment Committee
          </Badge>
        </div>

        <TextAnimate
          as="h1"
          by="word"
          animation="blurInUp"
          duration={0.8}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.15] text-white"
          once
        >
          Never size a position on one model's thesis
        </TextAnimate>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          DebateKit forces AI to challenge AI on your investment thesis — bull case vs. bear case,
          macro stress-test, valuation cross-check. Each model reads and challenges the others.
          What takes analysts days takes your AI committee 15 minutes.
        </p>

        <div className="flex justify-center">
          <HoverBorderGradient
            as="a"
            containerClassName="mx-auto"
            className="flex items-center gap-2 px-6 py-2.5 text-base font-medium"
            href="/auth/sign-in"
          >
            Try It Free
            <Icons.arrowRight className="size-4" />
          </HoverBorderGradient>
        </div>

        <BlurFade delay={0.2} inView className="mt-16 max-w-5xl mx-auto">
          <LandingBrowserFrame>
            <InvestmentHeroDemo />
          </LandingBrowserFrame>
        </BlurFade>
      </div>
    </section>
  );
}

function HowDebateKitWorksSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="How It Works"
          heading="One Conversation."
          headingHighlight="Zero Blind Spots."
          description="Unlike single-model AI, DebateKit runs multiple models in parallel — and they can see and respond to each other."
        />

        <MotionDiv
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {LANDING_MODES.map((mode, i) => (
            <MotionDiv
              key={mode.title}
              initial={cellReveal.hidden}
              whileInView={cellReveal.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
            >
              <Card variant={CardVariants.GLASS} className="relative h-full">
                <GlowingEffect spread={30} glow proximity={48} disabled={false} />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <mode.icon className={`size-6 ${mode.color}`} />
                    <h3 className="text-lg font-semibold">{mode.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{mode.description}</p>
                </CardContent>
              </Card>
            </MotionDiv>
          ))}
        </MotionDiv>

        <p className="mt-10 text-center text-muted-foreground max-w-2xl mx-auto">
          You choose the mode. You assign the roles. The models do the rest — and a Council
          Moderator synthesizes the consensus at the end.
        </p>

      </div>
    </section>
  );
}

function WorkflowGapSection() {
  const stages = [
    { highlight: false, label: 'Data Access', status: 'Solved', tools: 'Bloomberg, AlphaSense, Tegus' },
    { highlight: true, label: 'Analysis', status: 'The Bottleneck', tools: 'Manual. 2-5 days per company.' },
    { highlight: false, label: 'Decision', status: 'Solved', tools: 'IC Meetings, Portfolio Systems' },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Use Case"
          heading="Investment Analysis Is"
          headingHighlight="Drowning in Data"
          description="Bloomberg gives you the data. AlphaSense lets you search it. But the critical analysis layer — synthesizing bull/bear cases, stress-testing your thesis, writing the memo? Entirely manual."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          {stages.map((stage, i) => (
            <div key={stage.label} className="flex items-stretch gap-4 sm:gap-6 md:flex-col">
              <div className="relative flex-1">
                <Card
                  variant={stage.highlight ? CardVariants.GLASS_STRONG : CardVariants.GLASS_SUBTLE}
                  className={stage.highlight ? 'ring-1 ring-primary/30' : ''}
                >
                  {stage.highlight && (
                    <GlowingEffect spread={40} glow proximity={64} disabled={false} />
                  )}
                  <CardContent className="text-center py-8">
                    <Badge variant={stage.highlight ? 'default' : 'secondary'} className="mb-3">
                      {stage.status}
                    </Badge>
                    <h3 className="text-xl font-semibold mb-2">{stage.label}</h3>
                    <p className="text-sm text-muted-foreground">{stage.tools}</p>
                  </CardContent>
                </Card>
              </div>
              {i < stages.length - 1 && (
                <div className="hidden md:flex items-center justify-center absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2">
                  <Icons.arrowRight className="size-5 text-muted-foreground/50" />
                </div>
              )}
            </div>
          ))}
        </div>

        <MotionDiv
          className="mt-12 text-center"
          initial={subtleFade.hidden}
          whileInView={subtleFade.visible}
          viewport={VIEWPORT_ONCE}
          transition={quickTransition}
        >
          <p className="text-3xl sm:text-4xl font-semibold mb-4">
            <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">500+</span>
            {' companies report in a '}
            <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">6-week</span>
            {' window.'}
          </p>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Every earnings season, analysts drown in transcripts and filings.
            Each company takes 2-3 hours — and coverage gaps mean missed opportunities.
          </p>
        </MotionDiv>
      </div>
    </section>
  );
}

function WhoThisIsForSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Who This Is For"
          heading="Built for Investment Teams"
          headingHighlight="Under Pressure"
          description="Whether you cover 20 names or 200, the bottleneck is the same: too much data, too little time, and no room for blind spots."
        />

        <MotionDiv
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {PERSONAS.map((persona, i) => (
            <MotionDiv
              key={persona.title}
              initial={cellReveal.hidden}
              whileInView={cellReveal.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
            >
              <Card variant={CardVariants.GLASS} className="relative h-full">
                <GlowingEffect spread={30} glow proximity={48} disabled={false} />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <persona.icon className={`size-6 ${persona.color}`} />
                    <h3 className="text-lg font-semibold">{persona.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">{persona.description}</p>
                  <Badge variant="secondary" className="text-xs">{persona.painPoint}</Badge>
                </CardContent>
              </Card>
            </MotionDiv>
          ))}
        </MotionDiv>
      </div>
    </section>
  );
}

function WhyNotSingleModelSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Single-Model Problem"
          heading="Why Asking ChatGPT for Investment Advice"
          headingHighlight="Doesn't Work"
          description="Generic AI can summarize. But investment analysis demands adversarial thinking, precision, and multi-perspective reasoning that a single model cannot deliver."
        />

        <MotionDiv
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {SINGLE_MODEL_FAILURES.map((item, i) => (
            <MotionDiv
              key={item.number}
              initial={cellReveal.hidden}
              whileInView={cellReveal.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
            >
              <Card variant={CardVariants.GLASS} className="relative h-full">
                <GlowingEffect spread={30} glow proximity={48} disabled={false} />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="destructive" className="font-mono text-xs">{item.number}</Badge>
                    <item.icon className="size-5 text-destructive/70" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            </MotionDiv>
          ))}
        </MotionDiv>

        <p className="mt-10 text-center text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          DebateKit fixes this. When a Bull Case Analyst and Bear Case Analyst debate the same
          data — and a Valuation Expert stress-tests the assumptions — confirmation bias gets
          caught, hallucinations get flagged, and nothing gets past you.
        </p>
      </div>
    </section>
  );
}

function WhyMultipleModelsSection() {
  const advantages = [
    {
      description: 'When the Bull Case Analyst cites revenue acceleration, the Bear Case Analyst can challenge the sustainability. Errors and bias don\'t survive cross-examination.',
      icon: Icons.shieldAlert,
      title: 'Adversarial Debate Kills Bias',
    },
    {
      description: 'A strong earnings quarter means nothing if the macro cycle is turning. When Macro and Valuation agents weigh in alongside Bull and Bear, the picture becomes three-dimensional.',
      icon: Icons.eye,
      title: 'Multiple Perspectives, Full Picture',
    },
    {
      description: 'Filings, transcripts, analyst estimates, and market data need cross-referencing. When models respond to each other, they naturally connect dots across sources.',
      icon: Icons.layers,
      title: 'Synthesis Through Conversation',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Multiple Models Catch"
          headingHighlight="What One Misses"
          description="A single AI gives you a summary. But when Bull and Bear models debate the same investment — and Macro and Valuation experts add context — confirmation bias gets caught, blind spots get exposed, and nuance survives."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {advantages.map(item => (
            <Card key={item.title} variant={CardVariants.GLASS_SUBTLE}>
              <CardContent className="pt-6">
                <item.icon className="size-8 text-primary/70 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function InvestmentCommitteeSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Configurable Roles"
          heading="Assign Roles."
          headingHighlight="Start the Debate."
          description="In DebateKit, you pick the AI models and assign each one a role — just like staffing a real investment committee. Here's a setup research teams use for analysis:"
        />

        <MotionDiv
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {ROLES.map((role, i) => (
            <MotionDiv
              key={role.title}
              initial={cellReveal.hidden}
              whileInView={cellReveal.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
            >
              <Card variant={CardVariants.GLASS} className="relative h-full">
                <GlowingEffect spread={30} glow proximity={48} disabled={false} />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <role.icon className={`size-6 ${role.color}`} />
                    <h3 className="text-lg font-semibold">{role.title}</h3>
                    <Badge variant="secondary" className="text-xs ml-auto">{role.model}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{role.description}</p>
                </CardContent>
              </Card>
            </MotionDiv>
          ))}
        </MotionDiv>

        {/* Unified preset/builder demo */}
        <div className="mt-12">
          <BlurFade delay={0.1} inView className="max-w-4xl mx-auto">
            <LandingBrowserFrame>
              <InvestmentConfigDemo />
            </LandingBrowserFrame>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const manualSteps = [
    'Gather SEC filings, transcripts, reports (1-2 hours)',
    'Read and annotate earnings call (2-3 hours)',
    'Build comparable company analysis (3-4 hours)',
    'Synthesize bull/bear cases (2-4 hours)',
    'Draft investment memo (4-8 hours)',
  ];

  const debatekitSteps = [
    'Upload filings, transcripts, and supporting docs',
    'AI models analyze in parallel — bull and bear genuinely debate',
    'Council Moderator synthesizes consensus with conviction scores',
    'You review the memo and make the investment decision',
  ];

  return (
    <section id="how-it-works" className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Days of Analysis →"
          headingHighlight="15 Minutes of AI Debate"
          description="From raw filings to structured investment memo."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Manual workflow */}
          <Card variant={CardVariants.GLASS_SUBTLE}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="secondary">Manual</Badge>
                <span className="text-sm font-medium text-destructive/70">2-5 Days</span>
              </div>
              <ol className="space-y-4">
                {manualSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-sm text-muted-foreground/60 line-through">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* DebateKit workflow -- pricing-style colorful border */}
          <div className="relative rounded-2xl border-2 border-white/20 dark:border-white/10 p-2 md:rounded-3xl md:p-3">
            <GlowingEffect blur={0} borderWidth={2} spread={80} glow proximity={64} inactiveZone={0.01} disabled={false} />
            <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-white/20 dark:border-white/10 bg-background/50 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge>DebateKit</Badge>
                <span className="text-sm font-medium text-emerald-400">~15 Minutes</span>
              </div>
              <ol className="space-y-4">
                {debatekitSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <MotionSpan
                      className="flex-shrink-0 size-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary"
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={VIEWPORT_ONCE}
                      transition={{ delay: i * 0.15, duration: 0.4 }}
                    >
                      {i + 1}
                    </MotionSpan>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

function MarketValidationSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Market Momentum"
          heading="The Smartest Firms Are Already Using"
          headingHighlight="Multi-Agent AI"
          description="AI adoption in investment management has more than doubled. The firms that deploy AI-assisted research first will see every opportunity their competitors miss."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MARKET_STATS.map((item, i) => {
            const isCenter = i === 1;
            const numericValue = parseSingleNumber(item.stat);
            return (
              <Card
                key={item.stat}
                variant={isCenter ? CardVariants.GLASS_STRONG : CardVariants.GLASS_SUBTLE}
                className={isCenter ? 'relative ring-1 ring-primary/30' : ''}
              >
                {isCenter && (
                  <GlowingEffect spread={40} glow proximity={64} disabled={false} />
                )}
                <CardContent className="pt-6 text-center">
                  {numericValue !== null
                    ? (
                        <span className="text-4xl sm:text-5xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
                          <NumberTicker value={numericValue} className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent" />
                          %
                        </span>
                      )
                    : (
                        <p className="text-4xl sm:text-5xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">{item.stat}</p>
                      )}
                  <p className="text-sm text-muted-foreground mb-2">{item.label}</p>
                  <p className="text-xs italic text-muted-foreground/70">{item.source}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 max-w-2xl mx-auto text-center">
          <p className="text-muted-foreground leading-relaxed mb-4">
            BlackRock published AlphaAgents — a multi-agent LLM debate framework for equity portfolio
            construction. Bridgewater launched a $2B AI-led fund generating uncorrelated alpha.
          </p>
          <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
            "AIA Labs is building an artificial investor designed to perform rigorous, explainable,
            fundamental research at a scale no human-based process can ever achieve."
          </blockquote>
        </div>
      </div>
    </section>
  );
}

function StrategicAdvantagesSection() {
  const advantages = [
    {
      description: 'Analyze every company in your coverage universe. When 4 models work in parallel, no name gets skipped because someone ran out of time.',
      icon: Icons.eye,
      number: '01',
      title: 'Full Coverage',
    },
    {
      description: 'Identify estimate revision opportunities before the street catches up. AI debate produces structured memos in minutes, not days.',
      icon: Icons.zap,
      number: '02',
      title: 'Speed to Insight',
    },
    {
      description: 'No analyst fatigue. No late-Friday shortcuts. Every company gets the same multi-perspective adversarial analysis.',
      icon: Icons.checkCircle,
      number: '03',
      title: 'Consistency',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="A Research Team That"
          headingHighlight="Never Gets Tired"
          description="The same rigor on the last company of earnings season as the first."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {advantages.map((item, i) => (
            <MotionDiv
              key={item.number}
              initial={subtleFade.hidden}
              whileInView={subtleFade.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.1 }}
            >
              <Card variant={CardVariants.GLASS_SUBTLE}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="outline" className="font-mono text-xs">{item.number}</Badge>
                    <item.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSecuritySection() {
  const pillars = [
    {
      description: 'Every insight links to the model that produced it and the reasoning behind it. No black-box recommendations.',
      icon: Icons.fileSearch,
      title: 'Full Traceability',
    },
    {
      description: 'Your data stays private. API traffic is excluded from model training by our providers. All infrastructure runs on Cloudflare\'s encrypted global network.',
      icon: Icons.lock,
      title: 'Your Data Stays Yours',
    },
    {
      description: 'AI is the research team. You\'re the decision-maker. DebateKit accelerates your analysis — it doesn\'t replace your judgment.',
      icon: Icons.userCheck,
      title: 'Human-in-the-Loop',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Built for"
          headingHighlight="High-Stakes Decisions"
          description="DebateKit is designed for confidential, high-stakes analysis — whether that's investment research, portfolio management, or strategic planning."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map((item, i) => (
            <MotionDiv
              key={item.title}
              initial={subtleFade.hidden}
              whileInView={subtleFade.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.1 }}
            >
              <Card variant={CardVariants.GLASS_SUBTLE}>
                <CardContent className="pt-6">
                  <item.icon className="size-8 text-primary/70 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// JSON-LD DATA
// ============================================================================

function JsonLdScripts() {
  const productJsonLd = createProductJsonLd({
    description: 'AI-powered investment analysis with multiple AI models that debate bull/bear cases, assess macro context, and build valuation frameworks. Built for equity research, venture capital, and institutional asset managers. Structured investment memos in minutes, not days.',
    name: 'DebateKit AI Investment Analysis',
    path: '/solutions/investment-analysis',
    price: 0,
  });

  const faqJsonLd = createFAQPageJsonLd(
    FAQ_ITEMS.map(f => ({ answer: f.answer, question: f.question })),
  );

  const breadcrumbJsonLd = createBreadcrumbListJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Solutions', path: '/solutions/investment-analysis' },
    { name: 'Investment Analysis', path: '/solutions/investment-analysis' },
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

export default function InvestmentAnalysisScreen() {
  return (
    <LandingPageLayout>
      <JsonLdScripts />
      <HeroSection />
      <SectionDivider />
      <HowDebateKitWorksSection />
      <SectionDivider />
      <WorkflowGapSection />
      <SectionDivider />
      <WhoThisIsForSection />
      <SectionDivider />
      <WhyNotSingleModelSection />
      <SectionDivider />
      <WhyMultipleModelsSection />
      <SectionDivider />
      <InvestmentCommitteeSection />
      <SectionDivider />
      <HowItWorksSection />
      <SectionDivider />
      <MarketValidationSection />
      <ResearchFoundationCallout />
      <SectionDivider />
      <StrategicAdvantagesSection />
      <SectionDivider />
      <TrustSecuritySection />
      <SectionDivider />
      <FAQSection items={FAQ_ITEMS} variant="card" />
      <SectionDivider />
      <SolutionLinksSection currentPath="/solutions/investment-analysis" />
      <SectionDivider />
      <BottomCTASection
        heading="Your AI Investment Committee Is Ready"
        description="Assign the roles. Pick the models. Ask the hard questions. Whether it's earnings analysis, thesis validation, or any investment that deserves more than one perspective — DebateKit makes sure nothing gets past you."
        ctaText="Start Your First DebateKit"
      />
    </LandingPageLayout>
  );
}
