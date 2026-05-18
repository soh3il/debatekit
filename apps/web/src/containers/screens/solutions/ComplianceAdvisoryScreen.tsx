'use client';

import { CardVariants } from '@debatekit/shared';

import { Icons } from '@/components/icons';
import { ComplianceConfigDemo } from '@/components/landing/compliance-config-demo';
import { ComplianceHeroDemo } from '@/components/landing/compliance-hero-demo';
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
    answer: 'DebateKit is an AI peer review platform. You pick multiple AI models (Claude, GPT-4, Gemini, Grok, and more), assign each one a role, and choose a deliberation mode — Debating, Analyzing, Brainstorming, or Problem Solving. Each model sees and challenges the others\' outputs, and a Council Moderator synthesizes the verdict at the end.',
    question: 'What is DebateKit?',
  },
  {
    answer: 'Instead of one model producing a single compliance opinion, multiple models analyze regulatory requirements simultaneously — a Regulatory Monitor tracks the latest changes, a Gap Analyst maps your current controls against requirements, a Risk Prioritizer quantifies exposure, and an Advisory Drafter produces the remediation roadmap. Cross-examination between models catches blind spots and surfaces conflicts between regulatory frameworks.',
    question: 'How does multi-model AI improve compliance analysis?',
  },
  {
    answer: 'Claude, GPT-4, Gemini, Grok, DeepSeek, and more. You choose which models participate and what compliance role each represents. Roles are fully configurable — assign "Regulatory Monitor" to Claude, "Gap Analyst" to GPT-4, or any combination that fits your compliance workflow.',
    question: 'Which AI models does DebateKit use?',
  },
  {
    answer: 'No. DebateKit is an advisory tool that provides structured multi-perspective regulatory analysis. It does not constitute legal advice, does not replace qualified compliance counsel, and should not be used as the sole basis for compliance decisions. All regulatory determinations must be validated by qualified compliance professionals and legal counsel.',
    question: 'Does DebateKit replace compliance counsel?',
  },
  {
    answer: 'A typical regulatory change assessment produces a structured impact analysis with gap identification, risk scoring, and remediation recommendations in approximately 10-15 minutes. This includes multi-perspective review across compliance, risk, and advisory domains. The manual equivalent — tracking the regulatory change, assessing organizational impact, identifying gaps, scoring risks, and drafting remediation plans — typically takes 2-4 weeks depending on complexity and cross-departmental coordination.',
    question: 'How long does it take to analyze a regulatory change?',
  },
  {
    answer: 'Your data stays private. All traffic is encrypted via HTTPS and our infrastructure runs on Cloudflare\'s global network. We route through API endpoints that are contractually excluded from model training by our providers. Compliance data is isolated per-workspace and never shared across accounts.',
    question: 'Is my data secure?',
  },
  {
    answer: 'Absolutely. Compliance advisory is one use case. Teams use the same platform for M&A deal screening, investment analysis, legal review, strategic planning — any question that deserves more than one perspective. The multi-model deliberation works wherever rigorous analysis matters.',
    question: 'Can I use DebateKit for things other than compliance advisory?',
  },
  {
    answer: 'AI addresses the regulatory velocity problem — the reality that 257+ regulatory updates happen globally every day and compliance teams cannot manually track, assess, and respond to all of them. With multi-model AI, compliance officers get structured impact assessments immediately, enabling faster response to regulatory changes and more consistent risk evaluation across the organization.',
    question: 'How does AI improve compliance workflow?',
  },
  {
    answer: 'DebateKit is particularly valuable for regulatory change impact assessment, compliance gap analysis, cross-border regulatory review, pre-audit readiness evaluation, and regulatory risk scoring. Any scenario where multiple compliance perspectives would normally weigh in benefits from AI multi-perspective analysis.',
    question: 'What types of compliance scenarios work best with DebateKit?',
  },
  {
    answer: 'Different tools for different workflows. LogicGate and Hyperproof provide GRC workflow automation. ServiceNow GRC provides enterprise risk management. AuditBoard handles audit management. DebateKit sits on top: the analysis layer where you simulate multi-perspective compliance review. Those tools manage your compliance program — DebateKit helps you think about regulatory requirements from multiple angles. GRC Platform → Multi-Perspective AI Analysis (DebateKit) → Compliance Decision.',
    question: 'How is DebateKit different from LogicGate, Hyperproof, or ServiceNow GRC?',
  },
  {
    answer: 'DebateKit supports analysis across any regulatory framework you specify. Common frameworks include GDPR, CCPA/CPRA, EU AI Act, Dodd-Frank, Basel III/IV, SOX, HIPAA, AML/KYC, NIST AI RMF, MiFID II, DORA, and state-level privacy and AI regulations. You configure the regulatory context for each session.',
    question: 'Which regulatory frameworks does DebateKit cover?',
  },
] as const;

// ============================================================================
// MODE DATA
// ============================================================================

const MODES: readonly LandingMode[] = [
  {
    color: 'text-red-400',
    description: 'Models surface genuine disagreements about regulatory interpretation and compliance posture.',
    icon: Icons.scale,
    title: 'Debating',
  },
  {
    color: 'text-blue-400',
    description: 'Models examine regulations from different compliance domains, challenging each other\'s assessments.',
    icon: Icons.search,
    title: 'Analyzing',
  },
  {
    color: 'text-amber-400',
    description: 'Models explore creative compliance strategies and novel approaches to multi-jurisdictional requirements.',
    icon: Icons.lightbulb,
    title: 'Brainstorming',
  },
  {
    color: 'text-emerald-400',
    description: 'Models build toward actionable remediation roadmaps and prioritized compliance implementation plans.',
    icon: Icons.target,
    title: 'Problem Solving',
  },
];

// ============================================================================
// ROLE DATA
// ============================================================================

const ROLES: readonly LandingRole[] = [
  {
    color: 'text-emerald-400',
    description: 'Tracks regulatory updates, enforcement trends, comment period deadlines, and identifies applicable requirements across jurisdictions.',
    icon: Icons.globe,
    model: 'Claude',
    title: 'Regulatory Monitor',
  },
  {
    color: 'text-blue-400',
    description: 'Maps current organizational controls against regulatory requirements, identifies documentation deficiencies and control gaps.',
    icon: Icons.fileSearch,
    model: 'GPT-4',
    title: 'Gap Analyst',
  },
  {
    color: 'text-purple-400',
    description: 'Scores compliance gaps by severity, calculates regulatory exposure, and produces likelihood-weighted risk matrices.',
    icon: Icons.shieldAlert,
    model: 'Gemini',
    title: 'Risk Prioritizer',
  },
  {
    color: 'text-amber-400',
    description: 'Synthesizes findings into remediation roadmaps, board-ready summaries, and phased implementation timelines.',
    icon: Icons.fileText,
    model: 'Grok',
    title: 'Advisory Drafter',
  },
];

// ============================================================================
// PERSONA DATA
// ============================================================================

const PERSONAS: readonly LandingPersona[] = [
  {
    color: 'text-emerald-400',
    description: 'Monitoring 50+ regulatory frameworks simultaneously. Every missed update is potential enforcement action. Board expects proactive risk assessment, not reactive firefighting.',
    icon: Icons.shieldAlert,
    painPoint: 'Regulatory change velocity',
    title: 'Chief Compliance Officers',
  },
  {
    color: 'text-blue-400',
    description: 'Overlapping requirements from SEC, FINRA, OCC, CFPB, and state regulators. Cross-regulatory conflicts create impossible compliance matrices. Manual gap analysis takes weeks.',
    icon: Icons.briefcase,
    painPoint: 'Multi-regulator complexity',
    title: 'Regulated Financial Institutions',
  },
  {
    color: 'text-purple-400',
    description: 'HIPAA, HITECH, state health data laws, and emerging AI regulations create layered compliance obligations. Every new technology deployment requires fresh regulatory assessment.',
    icon: Icons.userCheck,
    painPoint: 'Layered regulatory obligations',
    title: 'Healthcare Organizations',
  },
  {
    color: 'text-amber-400',
    description: 'GDPR, CCPA/CPRA, EU AI Act, and state privacy laws across every market you operate in. Cross-border data flows create jurisdictional conflicts that no single framework resolves.',
    icon: Icons.globe,
    painPoint: 'Cross-border compliance',
    title: 'Technology Companies',
  },
];

// ============================================================================
// SINGLE-MODEL FAILURE DATA
// ============================================================================

const SINGLE_MODEL_FAILURES: readonly LandingFailure[] = [
  {
    description: 'A single model can\'t simultaneously track requirements from SEC, EU regulators, state attorneys general, and industry-specific bodies. Compliance spans jurisdictions and regulatory domains — a requirement valid under GDPR may conflict with CCPA. Single-model analysis misses these cross-regulatory tensions.',
    icon: Icons.globe,
    number: '01',
    title: 'Jurisdictional Blindness',
  },
  {
    description: 'Regulations change daily. A single model produces point-in-time answers but can\'t weigh new enforcement trends against historical patterns or connect a proposed rule to its downstream impact on existing controls. Compliance is dynamic — static analysis creates false confidence.',
    icon: Icons.alertTriangle,
    number: '02',
    title: 'Static Analysis Trap',
  },
  {
    description: 'Compliance isn\'t binary. It requires risk scoring across severity, likelihood, regulatory appetite, and organizational exposure. A single model produces narrative but not quantified risk assessment — the kind that boards and audit committees actually need for decision-making.',
    icon: Icons.layers,
    number: '03',
    title: 'Risk Quantification Gap',
  },
];

// ============================================================================
// MARKET STATS DATA
// ============================================================================

const MARKET_STATS: readonly MarketStat[] = [
  {
    label: 'regulatory updates per day globally',
    source: 'Thomson Reuters Regulatory Intelligence',
    stat: '257',
  },
  {
    label: 'average cost per compliance violation in financial services',
    source: 'Ponemon Institute',
    stat: '$4.24M',
  },
  {
    label: 'projected GRC software market by 2028',
    source: 'MarketsandMarkets',
    stat: '$28.2B',
  },
];

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
            Your AI Compliance Team
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
          Never sign off on compliance with one model's read
        </TextAnimate>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          DebateKit forces AI to challenge AI on your compliance review — one tracks regulatory
          changes, another maps your gaps, a third scores risk. Cross-examination catches what any
          single model misses. Structured compliance analysis in minutes, not weeks.
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

        <BlurFade delay={0.2} inView>
          <div className="mt-16 max-w-5xl mx-auto">
            <LandingBrowserFrame>
              <ComplianceHeroDemo />
            </LandingBrowserFrame>
          </div>
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
          heading="One Regulation."
          headingHighlight="Every Perspective Heard."
          description="Unlike single-model AI, DebateKit runs multiple models in parallel — and they can see and challenge each other's compliance analysis."
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
          You choose the mode. You assign the compliance roles. The models do the rest — and a Council
          Moderator synthesizes the consensus at the end.
        </p>
      </div>
    </section>
  );
}

function WorkflowGapSection() {
  const stages = [
    { highlight: false, label: 'Regulatory Data', status: 'Solved', tools: 'Thomson Reuters, LexisNexis, RegTech feeds' },
    { highlight: true, label: 'Compliance Analysis', status: 'The Bottleneck', tools: 'Manual. Weeks per regulatory change.' },
    { highlight: false, label: 'GRC Workflow', status: 'Solved', tools: 'LogicGate, ServiceNow, Hyperproof' },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Use Case"
          heading="Compliance Analysis Is"
          headingHighlight="the Bottleneck"
          description="Thomson Reuters gives you the regulatory feeds. LexisNexis gives you the legal research. But the critical analysis layer — assessing impact, mapping gaps, scoring risks, and drafting remediation plans? That still happens manually, across departments, over weeks."
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
            <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">257 regulatory updates</span>
            {' per day '}
            <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">globally</span>
            . Your team can't read them all.
          </p>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Regulatory change velocity is accelerating. New frameworks like the EU AI Act, DORA,
            and expanding state privacy laws are creating unprecedented compliance complexity.
            Manual analysis doesn't scale.
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
          heading="Built for Compliance Teams"
          headingHighlight="Under Pressure"
          description="Whether you're assessing a new regulation, preparing for audit, or navigating cross-border requirements — the need is the same: multi-perspective analysis, fast."
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
          heading="Why Asking ChatGPT About Compliance"
          headingHighlight="Doesn't Work"
          description="Generic AI can summarize regulations. But compliance analysis demands multi-jurisdictional awareness, dynamic risk scoring, and quantified exposure assessment that a single model cannot deliver."
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
          DebateKit fixes this. When a Regulatory Monitor and Gap Analyst debate the
          same requirement — and a Risk Prioritizer and Advisory Drafter add context — jurisdictional
          conflicts get caught, risks get quantified, and remediation plans get stress-tested.
        </p>
      </div>
    </section>
  );
}

function WhyMultipleModelsSection() {
  const advantages = [
    {
      description: 'When the Regulatory Monitor identifies a new requirement, the Gap Analyst can immediately assess organizational impact. When both miss a cross-regulatory conflict, the Risk Prioritizer catches it. Blind spots don\'t survive multi-perspective examination.',
      icon: Icons.shieldAlert,
      title: 'Cross-Domain Challenge Catches Gaps',
    },
    {
      description: 'A regulatory change means different things to different compliance domains. When regulatory, operational, risk, and advisory perspectives all weigh in, the impact assessment becomes three-dimensional.',
      icon: Icons.eye,
      title: 'Multiple Domains, Full Picture',
    },
    {
      description: 'Regulations, controls, risks, and remediation plans need cross-referencing. When models respond to each other, they naturally connect dots across compliance domains that siloed analysis misses.',
      icon: Icons.layers,
      title: 'Synthesis Through Deliberation',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Multiple Compliance Experts Catch"
          headingHighlight="What One Misses"
          description="A single AI gives you a regulatory summary. But when Regulatory Monitor, Gap Analyst, Risk Prioritizer, and Advisory Drafter models debate the same requirement — jurisdictional conflicts get caught, risks get quantified, and remediation plans get prioritized."
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

function ComplianceTeamSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Configurable Compliance Roles"
          heading="Assign Compliance Roles."
          headingHighlight="Start the Review."
          description="In DebateKit, you pick the AI models and assign each one a compliance function — just like convening a real compliance committee. Here's a setup compliance teams use for regulatory assessments:"
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

        <div className="mt-12">
          <BlurFade delay={0.2} inView>
            <div className="max-w-4xl mx-auto">
              <LandingBrowserFrame>
                <ComplianceConfigDemo />
              </LandingBrowserFrame>
            </div>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const manualSteps = [
    'New regulation published (discover it days to weeks later)',
    'Read and interpret regulatory text (1-2 days)',
    'Assess organizational impact across departments (1-2 weeks)',
    'Draft gap analysis and risk assessment (1-2 weeks)',
    'Produce remediation plan and board summary (1 week)',
  ];

  const debatekitSteps = [
    'Describe the regulatory change or compliance question',
    'AI compliance experts analyze in parallel — each from their domain',
    'Council Moderator synthesizes consensus with risk scores',
    'You review the analysis and make compliance decisions',
  ];

  return (
    <section id="how-it-works" className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Weeks of Manual Analysis"
          headingHighlight="→ Minutes of AI Advisory"
          description="From regulatory change to structured compliance advisory."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card variant={CardVariants.GLASS_SUBTLE}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="secondary">Manual</Badge>
                <span className="text-sm font-medium text-destructive/70">4-6 Weeks</span>
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
                      transition={{ ...quickTransition, delay: i * 0.15 }}
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
          heading="Compliance AI Has Reached"
          headingHighlight="an Inflection Point"
          description="The EU AI Act, DORA, and expanding state privacy laws are creating unprecedented regulatory complexity. Compliance teams that don't adopt AI will fall behind the regulatory curve."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MARKET_STATS.map((item, i) => {
            const isCenter = i === 1;
            // Parse numeric value for NumberTicker: '257' -> 257, '$4.24M' -> not pure number, '$28.2B' -> not pure number
            const numericMatch = /^(\d+)$/.exec(item.stat);

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
                  <p className="text-4xl sm:text-5xl font-bold mb-2">
                    {numericMatch
                      ? (
                          <NumberTicker
                            value={Number(numericMatch[1])}
                            className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent"
                          />
                        )
                      : (
                          <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">{item.stat}</span>
                        )}
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">{item.label}</p>
                  <p className="text-xs italic text-muted-foreground/70">{item.source}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 max-w-2xl mx-auto text-center">
          <p className="text-muted-foreground leading-relaxed mb-4">
            89% of compliance officers report increased regulatory burden year-over-year.
            Major financial institutions are deploying AI for regulatory monitoring and compliance
            gap analysis. The firms that adopt AI-assisted compliance first will stay ahead of the curve.
          </p>
          <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
            "Compliance teams that rely on manual processes will be unable to keep pace with the velocity
            of regulatory change. AI is no longer optional — it's essential."
          </blockquote>
        </div>
      </div>
    </section>
  );
}

function StrategicAdvantagesSection() {
  const advantages = [
    {
      description: 'Get structured multi-perspective analysis for every regulatory change. When 4 AI compliance experts work in parallel, no requirement goes unassessed.',
      icon: Icons.eye,
      number: '01',
      title: 'Complete Coverage',
    },
    {
      description: 'Multi-perspective compliance advisory in minutes, not weeks. Immediate structured analysis supports faster regulatory response and more proactive risk management.',
      icon: Icons.zap,
      number: '02',
      title: 'Speed to Compliance',
    },
    {
      description: 'Every regulatory change gets the same multi-perspective rigor — whether it\'s the first assessment of the quarter or the fiftieth. No analyst fatigue, no oversight drift.',
      icon: Icons.checkCircle,
      number: '03',
      title: 'Consistent Analysis',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="A Compliance Team That"
          headingHighlight="Never Falls Behind"
          description="The same rigor on the last regulatory assessment as the first."
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
      description: 'Every insight links to the model that produced it and the regulatory source it cited. No black-box opinions — every recommendation has a reasoning trail you can audit.',
      icon: Icons.fileSearch,
      title: 'Full Traceability',
    },
    {
      description: 'Your data stays private. API traffic is excluded from model training by our providers. All infrastructure runs on Cloudflare\'s encrypted global network. Compliance data is isolated per-workspace.',
      icon: Icons.lock,
      title: 'Your Data Stays Yours',
    },
    {
      description: 'AI is the analysis team. You\'re the compliance officer. DebateKit provides structured reasoning to support your judgment — it never makes autonomous compliance decisions.',
      icon: Icons.userCheck,
      title: 'Human-in-the-Loop',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Built for"
          headingHighlight="Regulatory Confidence"
          description="DebateKit is designed for high-stakes compliance analysis — where every recommendation must be traceable, defensible, and ultimately validated by qualified compliance professionals."
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

        {/* Disclaimer */}
        <div className="mt-12 max-w-3xl mx-auto">
          <Card variant={CardVariants.GLASS_SUBTLE} className="border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Icons.alertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold mb-1">Important Disclaimer</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    DebateKit is an advisory tool. It does not constitute legal or compliance advice, is not a substitute
                    for qualified compliance counsel, and should not be used as the sole basis for regulatory compliance
                    decisions. All compliance determinations must be validated by qualified professionals.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
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
    description: 'AI-powered regulatory compliance analysis with multiple AI models that monitor regulatory changes, identify compliance gaps, score risks, and draft remediation roadmaps. Built for chief compliance officers, regulated financial institutions, and multinational corporations.',
    name: 'DebateKit AI Compliance Advisory',
    path: '/solutions/compliance-advisory',
    price: 0,
  });

  const faqJsonLd = createFAQPageJsonLd(
    FAQ_ITEMS.map(f => ({ answer: f.answer, question: f.question })),
  );

  const breadcrumbJsonLd = createBreadcrumbListJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Solutions', path: '/solutions/compliance-advisory' },
    { name: 'Compliance Advisory', path: '/solutions/compliance-advisory' },
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

export default function ComplianceAdvisoryScreen() {
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
      <ComplianceTeamSection />
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
      <SolutionLinksSection currentPath="/solutions/compliance-advisory" />
      <SectionDivider />
      <BottomCTASection
        heading="Your AI Compliance Team Is Ready"
        description="Assign the compliance roles. Pick the models. Describe the regulatory question. Whether it's regulatory change assessment, gap analysis, or any compliance question that deserves more than one perspective — DebateKit makes sure nothing gets missed."
        ctaText="Start Your First DebateKit"
      />
    </LandingPageLayout>
  );
}
