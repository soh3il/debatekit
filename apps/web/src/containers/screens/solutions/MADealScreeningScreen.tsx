'use client';

import { CardVariants } from '@debatekit/shared';

import { Icons } from '@/components/icons';
import { LandingBrowserFrame } from '@/components/landing/landing-browser-frame';
import { MAConfigDemo } from '@/components/landing/ma-config-demo';
import { MAHeroDemo } from '@/components/landing/ma-hero-demo';
import { BottomCTASection } from '@/components/landing/sections/bottom-cta-section';
import { FAQSection } from '@/components/landing/sections/faq-section';
import { LANDING_MODES } from '@/components/landing/sections/landing-modes';
import type { LandingFailure, LandingFAQItem, LandingPersona, LandingRole } from '@/components/landing/sections/landing-types';
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
    answer: 'DebateKit is an AI peer review platform. You pick multiple AI models (Claude, GPT-4, Gemini, Grok, and more), assign each one a role, and choose a deliberation mode — Debating, Analyzing, Brainstorming, or Problem Solving. Each model sees and challenges the others\' outputs, and a Council Moderator synthesizes the verdict at the end.',
    question: 'What is DebateKit?',
  },
  {
    answer: 'Instead of one model summarizing a CIM, multiple models analyze the deal from different perspectives — financial, legal, strategic, risk — and challenge each other\'s findings. Cross-checking between models catches hallucinations and surfaces nuance that a single model misses. A Financial Analyst model cites an EBITDA margin, and a Legal Counsel model can question the source.',
    question: 'How does multi-model AI improve M&A deal screening?',
  },
  {
    answer: 'Claude, GPT-4, Gemini, Grok, DeepSeek, and more. You choose which models sit at your table and what role each plays. Roles are fully configurable — assign "Financial Analyst" to Claude, "Legal Counsel" to GPT-4, or any combination that fits your workflow.',
    question: 'Which AI models does DebateKit use?',
  },
  {
    answer: 'DebateKit augments your deal team, it does not replace it. The platform handles the information processing — reading, extracting, cross-referencing, and structuring — so your associates can focus on judgment calls, relationship management, and strategic thinking. Think of it as giving every associate an AI-powered research team that works in minutes, not days.',
    question: 'Can DebateKit replace my deal screening associates?',
  },
  {
    answer: 'A typical CIM screening produces a structured deal brief in approximately 10 minutes. This includes financial analysis, legal risk assessment, strategic fit evaluation, and risk scoring. The manual equivalent — downloading, reading, modeling, and writing a memo — typically takes 2-3 days of associate time.',
    question: 'How long does it take to screen a deal?',
  },
  {
    answer: 'Your data stays private. All traffic is encrypted via HTTPS and our infrastructure runs on Cloudflare\'s global network. We route through API endpoints that are contractually excluded from model training by our providers. Conversations and uploads are isolated per-workspace and never shared across accounts.',
    question: 'Is my data secure?',
  },
  {
    answer: 'Absolutely. M&A deal screening is one use case. Teams use the same platform for VC due diligence, strategic planning, legal analysis, product decisions, competitive research — any question that deserves more than one perspective. The multi-model deliberation works wherever rigorous analysis matters.',
    question: 'Can I use DebateKit for things other than M&A?',
  },
  {
    answer: 'AI accelerates the screening bottleneck — the phase between sourcing and deep diligence where associates manually evaluate 80 deals for every 1 that closes. With multi-model AI, each deal gets a structured brief in approximately 10 minutes instead of 2-4 hours of associate time. This means 100% pipeline coverage, no reviewer fatigue, and faster time to LOI.',
    question: 'How does AI improve private equity deal flow?',
  },
  {
    answer: 'Yes. Upload a CIM and DebateKit\'s AI models analyze it from multiple angles simultaneously — financial, legal, strategic, and risk — then debate their findings. The result is a structured deal brief with citations, not a generic summary. Each insight links to the model that produced it and the reasoning behind it.',
    question: 'Can DebateKit automate CIM analysis?',
  },
  {
    answer: 'DebateKit generates structured deal briefs that serve as the foundation for investment memos. Each brief includes financial analysis, legal risk assessment, strategic fit evaluation, and risk scoring — organized into sections that map directly to IC memo format. Your team reviews, refines, and adds judgment.',
    question: 'Does DebateKit generate investment memos?',
  },
  {
    answer: 'Different tools for different stages. Grata and PitchBook handle sourcing — finding targets. Datasite and Kira handle deep diligence — virtual data rooms and contract analysis. DebateKit sits in between: the screening phase where you evaluate which deals deserve diligence. Sourcing → Screening (DebateKit) → Diligence.',
    question: 'How is DebateKit different from Grata, Datasite, or Kira?',
  },
] as const;

// ============================================================================
// ROLE DATA
// ============================================================================

const ROLES: readonly LandingRole[] = [
  {
    color: 'text-emerald-400',
    description: 'EBITDA quality, revenue decomposition, working capital analysis, and financial model stress-testing.',
    icon: Icons.trendingUp,
    model: 'Claude',
    title: 'Financial Analyst',
  },
  {
    color: 'text-blue-400',
    description: 'Change-of-control clauses, IP ownership, litigation exposure, and consent requirements.',
    icon: Icons.scale,
    model: 'GPT-4',
    title: 'Legal Counsel',
  },
  {
    color: 'text-purple-400',
    description: 'Market positioning, thesis alignment, competitive moat assessment, and synergy identification.',
    icon: Icons.target,
    model: 'Gemini',
    title: 'Strategic Advisor',
  },
  {
    color: 'text-amber-400',
    description: 'ESG exposure, regulatory risk, key-person dependencies, and concentration vulnerabilities.',
    icon: Icons.shieldAlert,
    model: 'Grok',
    title: 'Risk Assessor',
  },
];

// ============================================================================
// PERSONA DATA
// ============================================================================

const PERSONAS: readonly LandingPersona[] = [
  {
    color: 'text-emerald-400',
    description: 'Screen 80+ deals/quarter. By deal #50, fatigue sets in and hidden gems get missed.',
    icon: Icons.briefcase,
    painPoint: 'Reviewer fatigue on high-volume pipelines',
    title: 'PE Associates & VPs',
  },
  {
    color: 'text-blue-400',
    description: 'Evaluate targets across buy-side and sell-side mandates. Speed to LOI wins the auction.',
    icon: Icons.trendingUp,
    painPoint: 'Competitive auction speed pressure',
    title: 'Investment Banks (M&A Advisory)',
  },
  {
    color: 'text-purple-400',
    description: 'Strategic buyers need screening mapped to internal thesis criteria. Generic summaries miss strategic fit.',
    icon: Icons.target,
    painPoint: 'Thesis alignment across diverse pipelines',
    title: 'Corporate Development Teams',
  },
  {
    color: 'text-amber-400',
    description: 'Smaller teams need to punch above their weight. AI deal team gives screening capacity of a firm 10\u00D7 your size.',
    icon: Icons.users,
    painPoint: 'Limited associate bandwidth',
    title: 'M&A Advisors & Boutiques',
  },
];

// ============================================================================
// CHATGPT FAILURE DATA
// ============================================================================

const CHATGPT_FAILURES: readonly LandingFailure[] = [
  {
    description: 'Single model doesn\'t know 40% customer concentration is catastrophic in manufacturing but acceptable in enterprise SaaS. Context-free analysis creates false confidence.',
    icon: Icons.brain,
    number: '01',
    title: 'No Industry Nuance',
  },
  {
    description: 'Hallucinated EBITDA margin or fabricated covenant doesn\'t just waste time \u2014 creates real liability when it reaches the investment committee.',
    icon: Icons.alertTriangle,
    number: '02',
    title: 'Hallucination Creates Liability',
  },
  {
    description: 'Screening requires cross-referencing CIMs, financials, legal agreements, market data. A clause innocuous in isolation may be material risk against regulatory filings.',
    icon: Icons.layers,
    number: '03',
    title: 'Single-Document Blindness',
  },
];

// ============================================================================
// MARKET STATS DATA
// ============================================================================

const MARKET_STATS = [
  {
    label: 'of M&A practitioners now use AI in their workflow',
    source: 'Bain & Company, 2025',
    stat: '45%',
    tickerSuffix: '%',
    tickerValue: 45,
  },
  {
    label: 'of PE firms actively adopting AI for deal screening',
    source: 'Deloitte / Bain survey',
    stat: '60%+',
    tickerSuffix: '%+',
    tickerValue: 60,
  },
  {
    label: 'of initial screening tasks can be automated with AI',
    source: 'McKinsey estimate',
    stat: '50\u201360%',
    tickerSuffix: null,
    tickerValue: null,
  },
] as const;

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
            Your AI Board of Directors
          </Badge>
        </div>

        <TextAnimate
          as="h1"
          by="word"
          animation="blurInUp"
          duration={0.8}
          once
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.15] text-white"
        >
          Never close a deal on one model's analysis
        </TextAnimate>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          DebateKit forces AI to challenge AI on your deals — financial, legal, strategic, and risk
          models read each other&apos;s findings, catch errors, and converge on a structured brief.
          What takes associates 3 days takes your AI deal team 10 minutes.
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
            <MAHeroDemo />
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
    { highlight: false, label: 'Sourcing', status: 'Solved', tools: 'Grata, PitchBook, Axial' },
    { highlight: true, label: 'Screening', status: 'The Bottleneck', tools: 'Manual. 80 deals → 1 close.' },
    { highlight: false, label: 'Diligence', status: 'Solved', tools: 'Datasite, Kira, DealRoom' },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Use Case"
          heading="M&A Screening Is Stuck in"
          headingHighlight="the Stone Age"
          description="Here's one problem DebateKit is uniquely suited to solve. Sourcing tools find thousands of targets. Diligence tools manage the deep dive. But the critical screening phase in between? Entirely manual."
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
            <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">80</span>
            {' deals evaluated per '}
            <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">1</span>
            {' closed.'}
          </p>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Hundreds of associate hours spent on deals that are mostly "No."
            Each screening takes 2-4 hours — and 79 out of 80 go nowhere.
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
          heading="Built for Deal Teams"
          headingHighlight="Under Pressure"
          description="Whether you evaluate 20 or 200 deals per quarter, the bottleneck is the same: too many CIMs, too few hours, and zero margin for error."
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

function WhyNotChatGPTSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Single-Model Problem"
          heading="Why Pasting a CIM into ChatGPT"
          headingHighlight="Doesn't Work"
          description="Generic AI can summarize. But M&A screening demands nuance, precision, and cross-document reasoning that a single model cannot deliver."
        />

        <MotionDiv
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {CHATGPT_FAILURES.map((item, i) => (
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
          DebateKit fixes this. When multiple models analyze the same deal from different
          perspectives — and challenge each other — hallucinations get caught, nuance survives,
          and nothing gets past you.
        </p>
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
          heading="The Smartest Firms Are Already Moving to"
          headingHighlight="Multi-Agent AI"
          description="AI adoption for M&A has more than doubled. The firms that deploy AI-assisted screening first will see every deal their competitors miss."
        />

        <MotionDiv
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {MARKET_STATS.map((item, i) => {
            const isCenter = i === 1;
            return (
              <MotionDiv
                key={item.stat}
                initial={cellReveal.hidden}
                whileInView={cellReveal.visible}
                viewport={VIEWPORT_ONCE}
                transition={{ ...quickTransition, delay: i * 0.04 }}
              >
                <Card
                  variant={isCenter ? CardVariants.GLASS_STRONG : CardVariants.GLASS_SUBTLE}
                  className={isCenter ? 'relative ring-1 ring-primary/30' : ''}
                >
                  {isCenter && (
                    <GlowingEffect spread={40} glow proximity={64} disabled={false} />
                  )}
                  <CardContent className="pt-6 text-center">
                    <p className="text-4xl sm:text-5xl font-bold mb-2">
                      {item.tickerValue !== null
                        ? (
                            <>
                              <NumberTicker
                                value={item.tickerValue}
                                className="bg-gradient-to-r from-amber-400 to-orange-300 bg-clip-text text-transparent"
                              />
                              <span className="bg-gradient-to-r from-amber-400 to-orange-300 bg-clip-text text-transparent">{item.tickerSuffix}</span>
                            </>
                          )
                        : (
                            <span className="bg-gradient-to-r from-amber-400 to-orange-300 bg-clip-text text-transparent">{item.stat}</span>
                          )}
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">{item.label}</p>
                    <p className="text-xs italic text-muted-foreground/70">{item.source}</p>
                  </CardContent>
                </Card>
              </MotionDiv>
            );
          })}
        </MotionDiv>

        <div className="mt-12 max-w-2xl mx-auto text-center">
          <p className="text-muted-foreground leading-relaxed mb-4">
            BlackRock and JPMorgan have already integrated multi-agent AI into their investment
            analysis workflows.
          </p>
          <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
            "This is not sci-fi; it is the immediate future of the asset class."
          </blockquote>
        </div>
      </div>
    </section>
  );
}

function WhyMultipleModelsSection() {
  const advantages = [
    {
      description: 'When the Financial Analyst model cites an EBITDA margin, the Legal Counsel model can question the source. Errors don\'t survive cross-examination.',
      icon: Icons.shieldAlert,
      title: 'Cross-Checking Kills Hallucinations',
    },
    {
      description: 'A 40% customer concentration means catastrophe in manufacturing but is acceptable in enterprise SaaS. A single model doesn\'t know the difference — but a debate surfaces it.',
      icon: Icons.eye,
      title: 'Different Lenses, Full Picture',
    },
    {
      description: 'CIMs, financials, legal agreements, and market data need cross-referencing. When models respond to each other, they naturally connect dots across documents.',
      icon: Icons.layers,
      title: 'Context Through Conversation',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Multiple Models Catch"
          headingHighlight="What One Misses"
          description="A single AI gives you a summary. But when multiple models analyze the same deal from different perspectives — and challenge each other — hallucinations get caught, blind spots get exposed, and nuance survives."
        />

        <MotionDiv
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {advantages.map((item, i) => (
            <MotionDiv
              key={item.title}
              initial={cellReveal.hidden}
              whileInView={cellReveal.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
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
        </MotionDiv>
      </div>
    </section>
  );
}

function DealTeamSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Configurable Roles"
          heading="Assign Roles."
          headingHighlight="Start the Debate."
          description="In DebateKit, you pick the AI models and assign each one a role — just like staffing a real deal team. Here's a setup PE teams use for screening:"
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
        <BlurFade delay={0.1} inView className="mt-12 max-w-4xl mx-auto">
          <LandingBrowserFrame>
            <MAConfigDemo />
          </LandingBrowserFrame>
        </BlurFade>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const manualSteps = [
    'Download CIM (30 min)',
    'Read 80-120 page PDF (2-3 hours)',
    'Build Excel model (3-4 hours)',
    'Draft Word memo (2-3 hours)',
    'Associate/VP review (1-2 days)',
  ];

  const debatekitSteps = [
    'Upload CIM and supporting docs',
    'AI models analyze in parallel — and debate findings',
    'Council Moderator synthesizes consensus and flags disagreements',
    'You review the brief and decide go/no-go',
  ];

  return (
    <section id="how-it-works" className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="3 Days of Work →"
          headingHighlight="10 Minutes of AI Debate"
          description="From CIM upload to structured deal brief."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Manual workflow */}
          <Card variant={CardVariants.GLASS_SUBTLE}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="secondary">Manual</Badge>
                <span className="text-sm font-medium text-destructive/70">3+ Days</span>
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

          {/* DebateKit workflow — pricing-style colorful border */}
          <div className="relative rounded-2xl border-2 border-white/20 dark:border-white/10 p-2 md:rounded-3xl md:p-3">
            <GlowingEffect blur={0} borderWidth={2} spread={80} glow proximity={64} inactiveZone={0.01} disabled={false} />
            <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-white/20 dark:border-white/10 bg-background/50 backdrop-blur-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge>DebateKit</Badge>
                <span className="text-sm font-medium text-emerald-400">~10 Minutes</span>
              </div>
              <ol className="space-y-4">
                {debatekitSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <MotionSpan
                      className="flex-shrink-0 size-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary"
                      initial={cellReveal.hidden}
                      whileInView={cellReveal.visible}
                      viewport={VIEWPORT_ONCE}
                      transition={{ ...quickTransition, delay: i * 0.08 }}
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

function StrategicAdvantagesSection() {
  const advantages = [
    {
      description: 'Screen 100% of your pipeline. When 4 models work in parallel, no deal gets skipped because someone ran out of time.',
      icon: Icons.eye,
      number: '01',
      title: 'Total Coverage',
    },
    {
      description: 'Move to Letter of Intent before competitors finish reading the PDF. AI debate produces structured briefs in minutes.',
      icon: Icons.zap,
      number: '02',
      title: 'Speed to LOI',
    },
    {
      description: 'No reviewer fatigue. No Friday afternoon shortcuts. Every deal gets the same multi-perspective analysis.',
      icon: Icons.checkCircle,
      number: '03',
      title: 'Consistency',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="A Team That"
          headingHighlight="Never Gets Tired"
          description="The same rigor on the last deal of the quarter as the first."
        />

        <MotionDiv
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {advantages.map((item, i) => (
            <MotionDiv
              key={item.number}
              initial={cellReveal.hidden}
              whileInView={cellReveal.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
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
        </MotionDiv>
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
      description: 'AI is the advisor. You\'re the decision-maker. DebateKit accelerates your judgment — it doesn\'t replace it.',
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
          description="DebateKit is designed for confidential, high-stakes analysis — whether that's M&A deals, legal disputes, or strategic planning."
        />

        <MotionDiv
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {pillars.map((item, i) => (
            <MotionDiv
              key={item.title}
              initial={cellReveal.hidden}
              whileInView={cellReveal.visible}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
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
        </MotionDiv>
      </div>
    </section>
  );
}

// ============================================================================
// JSON-LD DATA
// ============================================================================

function JsonLdScripts() {
  const productJsonLd = createProductJsonLd({
    description: 'AI-powered M&A deal screening for private equity, investment banks, and corporate development teams. Multiple AI models debate, challenge, and converge on structured deal briefs. Automate CIM analysis and generate investment memos in minutes, not days.',
    name: 'DebateKit AI M&A Deal Screening',
    path: '/solutions/ma-deal-screening',
    price: 0,
  });

  const faqJsonLd = createFAQPageJsonLd(
    FAQ_ITEMS.map(f => ({ answer: f.answer, question: f.question })),
  );

  const breadcrumbJsonLd = createBreadcrumbListJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Solutions', path: '/solutions/ma-deal-screening' },
    { name: 'M&A Deal Screening', path: '/solutions/ma-deal-screening' },
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

export default function MADealScreeningScreen() {
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
      <WhyNotChatGPTSection />
      <SectionDivider />
      <WhyMultipleModelsSection />
      <SectionDivider />
      <DealTeamSection />
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
      <SolutionLinksSection currentPath="/solutions/ma-deal-screening" />
      <SectionDivider />
      <BottomCTASection
        heading="Your AI Board of Directors Is Ready"
        description="Assign the roles. Pick the models. Ask the hard questions. Whether it's deal screening, strategy, or any decision that deserves more than one perspective — DebateKit makes sure nothing gets past you."
        ctaText="Start Your First DebateKit"
      />
    </LandingPageLayout>
  );
}
