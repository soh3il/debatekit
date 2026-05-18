'use client';

import { CardVariants } from '@debatekit/shared';

import { Icons } from '@/components/icons';
import { ArchitectureConfigDemo } from '@/components/landing/architecture-config-demo';
import { ArchitectureHeroDemo } from '@/components/landing/architecture-hero-demo';
import { LandingBrowserFrame } from '@/components/landing/landing-browser-frame';
import { BottomCTASection } from '@/components/landing/sections/bottom-cta-section';
import { FAQSection } from '@/components/landing/sections/faq-section';
import type { LandingFailure, LandingFAQItem, LandingMode, LandingPersona, LandingRole, MarketStat } from '@/components/landing/sections/landing-types';
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
    answer: 'Instead of one model producing a single recommendation, multiple models argue different perspectives simultaneously \u2014 then a Security Reviewer and Pragmatist add context. Cross-examination between models catches confirmation bias and reveals trade-offs that a single model would gloss over.',
    question: 'How does multi-model AI improve architecture decisions?',
  },
  {
    answer: 'Claude, GPT-4, Gemini, Grok, DeepSeek, and more. You choose which models sit at your architecture review and what role each plays. Roles are fully configurable \u2014 assign "Systems Architect" to Claude, "Performance Engineer" to GPT-4, or any combination that fits your review workflow.',
    question: 'Which AI models does DebateKit use?',
  },
  {
    answer: 'DebateKit augments your architecture review process, it does not replace it. The platform handles the multi-perspective analysis \u2014 evaluating trade-offs, stress-testing assumptions, identifying risks \u2014 so your architects can focus on judgment calls, organizational context, and strategic alignment.',
    question: 'Can DebateKit replace my architecture review board?',
  },
  {
    answer: 'A typical architecture review produces a structured analysis with trade-offs, risks, and recommendations in approximately 15 minutes. This includes evaluating alternatives, assessing security implications, analyzing performance characteristics, and documenting the reasoning. The manual equivalent \u2014 gathering context, running meetings, debating options, documenting decisions \u2014 typically takes 1-2 weeks.',
    question: 'How long does an architecture review take?',
  },
  {
    answer: 'Your data stays private. All traffic is encrypted via HTTPS and our infrastructure runs on Cloudflare\'s global network. We route through API endpoints that are contractually excluded from model training by our providers. Architecture documents and code are isolated per-workspace and never shared across accounts.',
    question: 'Is my code and architecture data secure?',
  },
  {
    answer: 'Any architecture decision with genuine trade-offs: microservices vs monolith, SQL vs NoSQL, build vs buy, sync vs async, Kubernetes vs serverless, event-driven vs request-response. The more ambiguous the decision, the more valuable multi-perspective deliberation becomes.',
    question: 'What types of architecture decisions work best?',
  },
  {
    answer: 'A single model gives you one perspective and optimizes for a confident-sounding answer. DebateKit forces adversarial debate \u2014 the Performance Engineer challenges the Systems Architect\'s proposal, the Security Reviewer flags risks neither considered, and the Pragmatist grounds everything in operational reality. You get the arguments, not just the conclusion.',
    question: 'How is this different from asking ChatGPT about architecture?',
  },
  {
    answer: 'Completely. Assign any role to any model \u2014 Systems Architect, Performance Engineer, Security Reviewer, DevOps Lead, Data Architect, Cost Optimizer, or any custom role. Different architecture decisions benefit from different review compositions.',
    question: 'Can I customize the review roles?',
  },
  {
    answer: 'Not unconditionally. Wang et al. (Together AI + Stanford, ICLR 2025) demonstrated that open-source models collaborating via Mixture-of-Agents outperform GPT-4 Omni \u2014 collective reasoning surpasses individual capability. The consistent finding: structured disagreement catches trade-offs, risks, and edge cases that no single model surfaces on its own.',
    question: 'Does multi-model debate always improve architecture decisions?',
  },
] as const;

// ============================================================================
// MODE DATA
// ============================================================================

const MODES: readonly LandingMode[] = [
  {
    color: 'text-red-400',
    description: 'Models surface genuine disagreements on architecture trade-offs and explain their reasoning.',
    icon: Icons.scale,
    title: 'Debating',
  },
  {
    color: 'text-blue-400',
    description: 'Models examine architecture from different angles \u2014 performance, security, maintainability, cost.',
    icon: Icons.search,
    title: 'Analyzing',
  },
  {
    color: 'text-amber-400',
    description: 'Models explore novel architecture patterns and alternative approaches.',
    icon: Icons.lightbulb,
    title: 'Brainstorming',
  },
  {
    color: 'text-emerald-400',
    description: 'Models build on each other\'s proposals toward actionable architecture recommendations.',
    icon: Icons.target,
    title: 'Problem Solving',
  },
];

// ============================================================================
// ROLE DATA
// ============================================================================

const ROLES: readonly LandingRole[] = [
  {
    color: 'text-indigo-400',
    description: 'System design, service boundaries, data flow, and long-term architectural sustainability.',
    icon: Icons.layers,
    model: 'Claude',
    title: 'Systems Architect',
  },
  {
    color: 'text-red-400',
    description: 'Latency analysis, throughput modeling, resource optimization, and scalability assessment.',
    icon: Icons.zap,
    model: 'GPT-4',
    title: 'Performance Engineer',
  },
  {
    color: 'text-amber-400',
    description: 'Attack surface analysis, auth boundaries, data protection, and compliance requirements.',
    icon: Icons.shieldCheck,
    model: 'Gemini',
    title: 'Security Reviewer',
  },
  {
    color: 'text-emerald-400',
    description: 'Operational complexity, team capacity, timeline constraints, and migration risk.',
    icon: Icons.wrench,
    model: 'Grok',
    title: 'Pragmatist',
  },
];

// ============================================================================
// PERSONA DATA
// ============================================================================

const PERSONAS: readonly LandingPersona[] = [
  {
    color: 'text-indigo-400',
    description: 'Make architecture decisions that affect the entire codebase. One wrong call means months of rework.',
    icon: Icons.layers,
    painPoint: 'Architecture decisions with irreversible consequences',
    title: 'Engineering Leads',
  },
  {
    color: 'text-blue-400',
    description: 'Evaluate build vs buy, select infrastructure, and plan technical strategy for the organization.',
    icon: Icons.briefcase,
    painPoint: 'Technical strategy under uncertainty',
    title: 'CTOs & VPs of Engineering',
  },
  {
    color: 'text-purple-400',
    description: 'Design shared infrastructure, evaluate new technologies, and maintain platform reliability.',
    icon: Icons.database,
    painPoint: 'Platform decisions that affect all teams',
    title: 'Platform Teams',
  },
  {
    color: 'text-amber-400',
    description: 'Review architecture proposals, assess technical risk, and ensure design consistency across the org.',
    icon: Icons.eye,
    painPoint: 'Review bandwidth vs. decision velocity',
    title: 'Architecture Review Boards',
  },
];

// ============================================================================
// SINGLE-MODEL FAILURE DATA
// ============================================================================

const SINGLE_MODEL_FAILURES: readonly LandingFailure[] = [
  {
    description: 'LLMs optimize for confident-sounding answers. When you ask about microservices, you get a microservices pitch. Ask about monoliths, you get a monolith pitch. Architecture decisions need adversarial testing, not agreement.',
    icon: Icons.brain,
    number: '01',
    title: 'Confirmation Bias in Recommendations',
  },
  {
    description: 'A single model doesn\'t know your team size, your deployment pipeline, or your on-call rotation. It optimizes for theoretical elegance, not operational reality. Architecture is as much about people as about code.',
    icon: Icons.alertTriangle,
    number: '02',
    title: 'Missing Operational Context',
  },
  {
    description: 'Architecture involves security, performance, cost, maintainability, and team dynamics simultaneously. A single model produces one coherent narrative but misses the tensions between dimensions that matter most.',
    icon: Icons.layers,
    number: '03',
    title: 'Single-Dimension Analysis',
  },
];

// ============================================================================
// MARKET STATS DATA
// ============================================================================

const MARKET_STATS: readonly MarketStat[] = [
  {
    label: 'of architecture decisions are reversed within 12 months',
    source: 'Thoughtworks Technology Radar 2024',
    stat: '40%',
  },
  {
    label: 'cost of fixing architecture errors post-deployment vs. design phase',
    source: 'IEEE Software Engineering Economics',
    stat: '10-100x',
  },
  {
    label: 'of engineering time spent on accidental complexity from poor architecture',
    source: 'Stripe Developer Coefficient 2023',
    stat: '42%',
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
            Your AI Architecture Review Board
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
          Never commit to an architecture on one model&apos;s opinion
        </TextAnimate>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          DebateKit forces AI to challenge AI on your architecture decisions — trade-offs,
          security implications, operational readiness. Each model reads and challenges the others.
          What takes review boards weeks takes your AI council 15 minutes.
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
            <ArchitectureHeroDemo />
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
          description="Unlike single-model AI, DebateKit runs multiple models in parallel \u2014 and they can see and respond to each other."
        />

        <MotionDiv
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {MODES.map((mode, i) => (
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
    { highlight: false, label: 'Context Gathering', status: 'Manual', tools: 'Docs, wikis, tribal knowledge' },
    { highlight: true, label: 'Architecture Analysis', status: 'The Bottleneck', tools: 'Manual. 1-2 weeks per decision.' },
    { highlight: false, label: 'Decision & Documentation', status: 'Manual', tools: 'ADRs, review meetings, Confluence' },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Use Case"
          heading="Architecture Decisions Are"
          headingHighlight="Too Expensive to Get Wrong"
          description="Your team gathers context for days. The review meeting debates for hours. The ADR gets written \u2014 and six months later, you discover the decision was wrong because nobody considered the third option."
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
            <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">6</span>
            {' architecture decisions per quarter.'}
          </p>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Each one affects every engineer on the team. Microservices vs monolith, SQL vs NoSQL,
            build vs buy — every decision deserves more than one model&apos;s opinion.
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
          heading="Built for Engineering Teams"
          headingHighlight="Making Hard Calls"
          description="Whether you're picking between monolith and microservices or evaluating a new database, the bottleneck is the same: too many trade-offs, too little time, and no room for blind spots."
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
          heading="Why Asking ChatGPT for Architecture Advice"
          headingHighlight="Doesn't Work"
          description="Generic AI can summarize best practices. But architecture decisions demand adversarial thinking, operational context, and multi-dimensional analysis that a single model cannot deliver."
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
          DebateKit fixes this. When a Systems Architect and Performance Engineer debate the same
          design — and a Security Reviewer stress-tests the assumptions — confirmation bias gets
          caught, blind spots get flagged, and nothing gets past you.
        </p>
      </div>
    </section>
  );
}

function WhyMultipleModelsSection() {
  const advantages = [
    {
      description: 'When the Systems Architect proposes microservices, the Pragmatist challenges the operational complexity. The Performance Engineer models the latency impact. Errors and blind spots don\'t survive cross-examination.',
      icon: Icons.shieldAlert,
      title: 'Adversarial Review Kills Blind Spots',
    },
    {
      description: 'Architecture isn\'t just about code structure. When Security, Performance, and Operations perspectives weigh in alongside the Systems Architect, the analysis becomes multi-dimensional.',
      icon: Icons.eye,
      title: 'Multiple Perspectives, Complete Picture',
    },
    {
      description: 'Codebase context, team dynamics, deployment constraints, and business requirements need cross-referencing. When models respond to each other, they naturally connect dots across dimensions.',
      icon: Icons.layers,
      title: 'Synthesis Through Deliberation',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Multiple Models Catch"
          headingHighlight="What One Misses"
          description="A single AI gives you a recommendation. But when architect, performance, security, and ops models debate the same decision \u2014 confirmation bias gets caught, blind spots get exposed, and trade-offs become visible."
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

function ArchitectureTeamSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Configurable Roles"
          heading="Assign Roles."
          headingHighlight="Start the Review."
          description="In DebateKit, you pick the AI models and assign each one a role \u2014 just like staffing a real architecture review board. Here's a setup engineering teams use for architecture decisions:"
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
              <ArchitectureConfigDemo />
            </LandingBrowserFrame>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const manualSteps = [
    'Gather context: codebase, team structure, constraints (1-2 days)',
    'Schedule architecture review meeting (1-2 weeks lead time)',
    'Present proposal, debate alternatives (2-4 hours)',
    'Document decision in ADR (2-4 hours)',
    'Revisit when implementation reveals missed trade-offs (weeks later)',
  ];

  const debatekitSteps = [
    'Describe the architecture decision and constraints',
    'AI models analyze from different perspectives \u2014 architect, performance, security, ops',
    'Council Moderator synthesizes consensus with trade-off analysis',
    'You review the analysis and make the architecture call',
  ];

  return (
    <section id="how-it-works" className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Weeks of Review \u2192"
          headingHighlight="15 Minutes of AI Debate"
          description="From ambiguous requirements to documented architecture decision."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Manual workflow */}
          <Card variant={CardVariants.GLASS_SUBTLE}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="secondary">Manual</Badge>
                <span className="text-sm font-medium text-destructive/70">1-2 Weeks</span>
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
          heading="The Smartest Teams Are Already Using"
          headingHighlight="Multi-Agent AI for Architecture"
          description="Architecture decisions are too expensive to get wrong. The teams that deploy multi-perspective AI review first will catch the trade-offs their competitors miss."
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
            Google published a multi-agent architecture review framework. AWS Solution Architects use
            AI-assisted design validation. The pattern is clear: critical architecture decisions
            benefit from structured multi-perspective analysis.
          </p>
          <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
            &quot;The cost of fixing a software architecture error after deployment is 10-100x the cost
            of catching it during design review.&quot;
          </blockquote>
        </div>
      </div>
    </section>
  );
}

function StrategicAdvantagesSection() {
  const advantages = [
    {
      description: 'Every architecture decision gets the same multi-perspective adversarial analysis. No reviewer fatigue, no rush-through approvals.',
      icon: Icons.eye,
      number: '01',
      title: 'Consistent Rigor',
    },
    {
      description: 'From ambiguous requirements to documented decision in 15 minutes. No waiting for review board availability.',
      icon: Icons.zap,
      number: '02',
      title: 'Speed to Decision',
    },
    {
      description: 'Every decision includes the full reasoning trail \u2014 which trade-offs were considered, which risks were flagged, and why the verdict stands.',
      icon: Icons.checkCircle,
      number: '03',
      title: 'Decision Documentation',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="An Architecture Review Board That"
          headingHighlight="Never Gets Tired"
          description="The same rigor on the last architecture decision as the first."
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
      description: 'Your code and architecture data stay private. API traffic is excluded from model training by our providers. All infrastructure runs on Cloudflare\'s encrypted global network.',
      icon: Icons.lock,
      title: 'Your Code Stays Yours',
    },
    {
      description: 'AI is the review board. You\'re the decision-maker. DebateKit accelerates your analysis \u2014 it doesn\'t replace your judgment.',
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
          description="DebateKit is designed for confidential, critical work \u2014 architecture reviews, security assessments, infrastructure decisions."
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
    description: 'AI-powered architecture review with multiple AI models that debate trade-offs, assess security implications, and evaluate operational readiness. Built for engineering leads, CTOs, and platform teams. Structured architecture decisions in minutes, not weeks.',
    name: 'DebateKit AI Architecture Review',
    path: '/solutions/architecture-review',
    price: 0,
  });

  const faqJsonLd = createFAQPageJsonLd(
    FAQ_ITEMS.map(f => ({ answer: f.answer, question: f.question })),
  );

  const breadcrumbJsonLd = createBreadcrumbListJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Solutions', path: '/solutions/architecture-review' },
    { name: 'Architecture Review', path: '/solutions/architecture-review' },
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

export default function ArchitectureReviewScreen() {
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
      <ArchitectureTeamSection />
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
      <SolutionLinksSection currentPath="/solutions/architecture-review" />
      <SectionDivider />
      <BottomCTASection
        heading="Your Architecture Review Board Is Ready"
        description="Assign the roles. Pick the models. Ask the hard questions. Whether it's monolith vs microservices, build vs buy, or any architecture decision that deserves more than one perspective — DebateKit makes sure nothing gets past you."
        ctaText="Start Your First DebateKit"
      />
    </LandingPageLayout>
  );
}
