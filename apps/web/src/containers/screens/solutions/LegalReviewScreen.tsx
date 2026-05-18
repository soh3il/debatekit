'use client';

import { CardVariants } from '@debatekit/shared';

import { Icons } from '@/components/icons';
import { LandingBrowserFrame } from '@/components/landing/landing-browser-frame';
import { LegalConfigDemo } from '@/components/landing/legal-config-demo';
import { LegalHeroDemo } from '@/components/landing/legal-hero-demo';
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
    answer: 'Instead of one model reviewing a contract from a single angle, multiple models analyze simultaneously — a Contract Analyst flags clause risks, a Compliance Reviewer checks regulatory alignment, an IP Specialist evaluates assignment clauses, and a Litigation Assessor quantifies exposure. When the Contract Analyst flags a broad indemnification, the Litigation Assessor can immediately quantify the liability.',
    question: 'How does multi-model AI improve contract review?',
  },
  {
    answer: 'Claude, GPT-4, Gemini, Grok, DeepSeek, and more. You choose which models sit at your legal review table and what role each plays. Roles are fully configurable — assign "Contract Analyst" to Claude, "Compliance Reviewer" to GPT-4, or any combination that fits your review workflow.',
    question: 'Which AI models does DebateKit use?',
  },
  {
    answer: 'DebateKit augments your legal team, it does not replace it. The platform handles the information processing — reading clauses, cross-referencing terms, identifying risks, and structuring risk assessments — so your attorneys can focus on judgment calls, negotiation strategy, and client advice. Think of it as giving every attorney an AI-powered review team that works in minutes, not hours.',
    question: 'Can DebateKit replace my legal team?',
  },
  {
    answer: 'A typical contract review produces a structured risk assessment with clause-level analysis, compliance gaps, IP exposure, and litigation risk scoring in approximately 10 minutes. This includes obligation mapping, regulatory alignment checks, and recommended redlines. The manual equivalent — reading the full agreement, cross-referencing with policies, checking compliance requirements, and drafting the risk memo — typically takes 2-4 hours of attorney time.',
    question: 'How long does it take to review a contract?',
  },
  {
    answer: 'Your data stays private. All traffic is encrypted via HTTPS and our infrastructure runs on Cloudflare\'s global network. We route through API endpoints that are contractually excluded from model training by our providers. Documents and analysis are isolated per-workspace and never shared across accounts.',
    question: 'Is my data secure?',
  },
  {
    answer: 'Absolutely. Contract review is one use case. Teams use the same platform for M&A deal screening, investment analysis, strategic planning, compliance audits, litigation risk assessment — any question that deserves more than one perspective. The multi-model deliberation works wherever rigorous analysis matters.',
    question: 'Can I use DebateKit for things other than contract review?',
  },
  {
    answer: 'AI addresses the contract volume problem — the reality that legal departments review hundreds or thousands of contracts annually, each requiring hours of attorney time. With multi-model AI, each contract gets a structured risk assessment in approximately 10 minutes instead of 2-4 hours. This means full coverage, consistent quality, and faster time-to-signature.',
    question: 'How does AI improve legal workflow efficiency?',
  },
  {
    answer: 'Yes. Upload contracts, vendor agreements, NDAs, employment agreements, or any legal document and DebateKit\'s AI models analyze them from multiple legal perspectives simultaneously — contract terms, compliance obligations, IP exposure, and litigation risk — then debate their findings. The result is a structured risk assessment with recommended redlines, not a generic summary.',
    question: 'Can DebateKit analyze any type of legal document?',
  },
  {
    answer: 'DebateKit generates structured risk assessments that serve as the foundation for legal review memos. Each assessment includes clause-level risk scoring, compliance gap analysis, IP exposure evaluation, and litigation risk quantification — organized into sections that map directly to legal review format. Your team reviews, refines, and adds professional judgment.',
    question: 'Does DebateKit generate legal review memos?',
  },
  {
    answer: 'Different tools for different workflows. Harvey and CoCounsel provide single-model legal assistants for research and drafting. Kira and Luminance provide clause extraction and contract analytics. DebateKit sits on top: the analysis layer where you turn document review into multi-perspective risk assessment. These tools help you find clauses — DebateKit helps you think about them from competing legal perspectives. Document Review → Multi-Perspective Analysis (DebateKit) → Risk Assessment.',
    question: 'How is DebateKit different from Harvey, CoCounsel, or Kira?',
  },
] as const;

// ============================================================================
// MODE DATA
// ============================================================================

const MODES: readonly LandingMode[] = [
  {
    color: 'text-red-400',
    description: 'Models surface genuine disagreements about clause interpretation and risk severity.',
    icon: Icons.scale,
    title: 'Debating',
  },
  {
    color: 'text-blue-400',
    description: 'Models examine contracts from different legal angles, challenging each other\'s risk assessments.',
    icon: Icons.search,
    title: 'Analyzing',
  },
  {
    color: 'text-amber-400',
    description: 'Models generate creative negotiation strategies and alternative clause language.',
    icon: Icons.lightbulb,
    title: 'Brainstorming',
  },
  {
    color: 'text-emerald-400',
    description: 'Models build toward actionable redlines and negotiation recommendations.',
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
    description: 'Clause identification, obligation mapping, term extraction, and risk scoring across the full agreement.',
    icon: Icons.fileSearch,
    model: 'Claude',
    title: 'Contract Analyst',
  },
  {
    color: 'text-blue-400',
    description: 'Regulatory alignment (GDPR, CCPA, SOX), data processing addendum assessment, and policy gap analysis.',
    icon: Icons.shieldAlert,
    model: 'GPT-4',
    title: 'Compliance Reviewer',
  },
  {
    color: 'text-purple-400',
    description: 'Intellectual property rights, licensing terms, assignment clauses, and infringement risk evaluation.',
    icon: Icons.layers,
    model: 'Gemini',
    title: 'IP Specialist',
  },
  {
    color: 'text-red-400',
    description: 'Dispute exposure, liability quantification, enforceability analysis, and precedent comparison.',
    icon: Icons.scale,
    model: 'Grok',
    title: 'Litigation Assessor',
  },
];

// ============================================================================
// PERSONA DATA
// ============================================================================

const PERSONAS: readonly LandingPersona[] = [
  {
    color: 'text-emerald-400',
    description: 'Review 50+ contracts/month across practice areas. Missed clauses create malpractice exposure and client trust issues.',
    icon: Icons.briefcase,
    painPoint: 'Volume vs. thoroughness tradeoff',
    title: 'Law Firm Partners',
  },
  {
    color: 'text-blue-400',
    description: 'Manage vendor agreements, employment contracts, and NDAs at scale. Outside counsel costs $500-1,000/hour for first-pass review.',
    icon: Icons.shieldAlert,
    painPoint: 'Outside counsel cost pressure',
    title: 'General Counsel & In-House Legal',
  },
  {
    color: 'text-purple-400',
    description: 'M&A due diligence requires reviewing hundreds of contracts under time pressure. One missed change-of-control clause can kill a deal.',
    icon: Icons.layers,
    painPoint: 'Due diligence time compression',
    title: 'Corporate Development Teams',
  },
  {
    color: 'text-amber-400',
    description: 'Regulatory review across GDPR, CCPA, SOX, HIPAA. Every contract must meet compliance baselines before execution.',
    icon: Icons.fileSearch,
    painPoint: 'Multi-regulatory complexity',
    title: 'Compliance Officers',
  },
];

// ============================================================================
// SINGLE-MODEL FAILURE DATA
// ============================================================================

const SINGLE_MODEL_FAILURES: readonly LandingFailure[] = [
  {
    description: 'A non-compete clause enforceable in Delaware may be void in California. A data transfer mechanism valid under EU-US Data Privacy Framework has different requirements under UK GDPR. Single models lack the multi-jurisdictional awareness that real legal analysis demands.',
    icon: Icons.globe,
    number: '01',
    title: 'Jurisdictional Blind Spots',
  },
  {
    description: 'LLMs frequently fabricate case citations, statute references, and regulatory requirements. A fabricated legal precedent in a client memo creates professional liability. Legal analysis demands verifiable, citation-backed reasoning that single models cannot reliably provide.',
    icon: Icons.alertTriangle,
    number: '02',
    title: 'Hallucinated Legal Citations',
  },
  {
    description: 'Contract risk spans commercial terms, compliance obligations, IP exposure, and litigation liability simultaneously. A broad indemnification clause interacts with a weak DPA to create uncapped breach liability — a single model analyzing one dimension at a time misses these cross-domain interactions.',
    icon: Icons.layers,
    number: '03',
    title: 'Cross-Domain Risk Blindness',
  },
];

// ============================================================================
// MARKET STATS DATA
// ============================================================================

const MARKET_STATS: readonly MarketStat[] = [
  {
    label: 'of corporate legal departments plan to increase AI spending',
    source: 'ACC/Gartner Survey, 2024',
    stat: '82%',
  },
  {
    label: 'time savings on contract review tasks with AI assistance',
    source: 'Thomson Reuters Legal AI Report',
    stat: '30-50%',
  },
  {
    label: 'projected legal AI market size by 2027',
    source: 'Grand View Research',
    stat: '$2.3B',
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
            Your AI Legal Review Team
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
          Never sign a contract one model reviewed
        </TextAnimate>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          DebateKit forces AI to challenge AI on your contracts — one flags clause risks, another
          checks compliance gaps, while IP and litigation reviewers stress-test every finding.
          What takes attorneys hours takes your AI legal team 10 minutes.
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
            <LegalHeroDemo />
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
          heading="One Review."
          headingHighlight="Every Angle Covered."
          description="Unlike single-model AI, DebateKit runs multiple models in parallel — and they can see and challenge each other's legal analysis."
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
    { highlight: false, label: 'Document Review', status: 'Solved', tools: 'Kira, Luminance, iManage' },
    { highlight: true, label: 'Risk Analysis', status: 'The Bottleneck', tools: 'Manual. 2-4 hours per contract.' },
    { highlight: false, label: 'Decision', status: 'Solved', tools: 'CLM Systems, DocuSign' },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Use Case"
          heading="Contract Review Is Drowning"
          headingHighlight="in Volume"
          description="Kira extracts the clauses. iManage stores the documents. But the critical analysis layer — evaluating risk across compliance, IP, and litigation perspectives, drafting the risk memo? Entirely manual."
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
            <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">80%</span>
            {' of contract review is '}
            <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">repetitive</span>
            {' pattern recognition.'}
          </p>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Senior attorneys spend hours on work that's below their expertise level.
            One missed clause can cost millions — but reviewing every clause manually doesn't scale.
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
          heading="Built for Legal Teams"
          headingHighlight="Under Pressure"
          description="Whether you review 20 contracts a month or 200, the bottleneck is the same: too many agreements, too little time, and no room for missed clauses."
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
          heading="Why Pasting a Contract into ChatGPT"
          headingHighlight="Doesn't Work"
          description="Generic AI can summarize clauses. But legal analysis demands jurisdictional awareness, cross-domain risk assessment, and citation-backed reasoning that a single model cannot deliver."
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
          DebateKit fixes this. When a Contract Analyst and Compliance Reviewer debate the same
          agreement — and IP and Litigation specialists challenge every finding — blind spots get
          caught, hallucinations get flagged, and nothing gets past you.
        </p>
      </div>
    </section>
  );
}

function WhyMultipleModelsSection() {
  const advantages = [
    {
      description: 'When the Contract Analyst flags a broad indemnification, the Litigation Assessor immediately quantifies the liability exposure. Errors and overlooked interactions don\'t survive cross-examination.',
      icon: Icons.shieldAlert,
      title: 'Cross-Examination Catches Everything',
    },
    {
      description: 'A permissive data transfer clause means nothing until Compliance flags GDPR exposure and IP Specialist identifies the assignment risk. When all four perspectives weigh in, the picture becomes complete.',
      icon: Icons.eye,
      title: 'Multiple Perspectives, Full Picture',
    },
    {
      description: 'Indemnification interacts with DPA. IP assignment interacts with termination. When models respond to each other, they naturally connect cross-clause dependencies that linear review misses.',
      icon: Icons.layers,
      title: 'Cross-Clause Dependency Analysis',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Multiple Models Catch"
          headingHighlight="What One Misses"
          description="A single AI gives you a clause summary. But when Contract, Compliance, IP, and Litigation models debate the same agreement — risks that span multiple domains get caught, and cross-clause interactions get exposed."
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

function LegalReviewTeamSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Configurable Roles"
          heading="Assign Roles."
          headingHighlight="Start the Review."
          description="In DebateKit, you pick the AI models and assign each one a legal specialty — just like staffing a real legal review team. Here's a setup legal teams use for contract analysis:"
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
        <BlurFade delay={0.15} inView className="mt-12 max-w-4xl mx-auto">
          <LandingBrowserFrame>
            <LegalConfigDemo />
          </LandingBrowserFrame>
        </BlurFade>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const manualSteps = [
    'Receive contract, add to review queue (30 minutes)',
    'Read full agreement, annotate clauses (2-3 hours)',
    'Cross-reference with compliance requirements (1-2 hours)',
    'Check IP and assignment provisions (30-60 minutes)',
    'Draft risk assessment memo with redlines (1-2 hours)',
  ];

  const debatekitSteps = [
    'Upload the contract or paste key sections',
    'AI models analyze in parallel — each from its legal specialty',
    'Council Moderator synthesizes consensus with risk scores',
    'You review the assessment and finalize redlines',
  ];

  return (
    <section id="how-it-works" className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Hours of Review"
          headingHighlight="10 Minutes of AI Debate"
          headingSuffix=" instead."
          description="From uploaded contract to structured risk assessment."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Manual workflow */}
          <Card variant={CardVariants.GLASS_SUBTLE}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="secondary">Manual</Badge>
                <span className="text-sm font-medium text-destructive/70">4-8 Hours</span>
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
                      transition={{ ...quickTransition, delay: i * 0.1 }}
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
          heading="Legal AI Has Reached"
          headingHighlight="an Inflection Point"
          description="Harvey raised $200M+ at a $2B valuation. Thomson Reuters acquired CoCounsel for $650M. The firms that adopt AI-assisted legal review first will operate at a different speed."
        />

        <MotionDiv
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={denseStagger.hidden}
          whileInView={denseStagger.visible}
          viewport={VIEWPORT_ONCE}
        >
          {MARKET_STATS.map((item, i) => {
            const isCenter = i === 1;
            // Extract numeric value for NumberTicker
            const numericMatch = item.stat.match(/(\d+)/);
            const numericValue = numericMatch?.[1] ? Number.parseInt(numericMatch[1], 10) : null;
            const prefix = item.stat.match(/^\D*/)?.[0] ?? '';
            const suffix = item.stat.match(/\D*$/)?.[0] ?? '';

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
                      {numericValue !== null
                        ? (
                            <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">
                              {prefix}
                              <NumberTicker
                                value={numericValue}
                                className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent text-4xl sm:text-5xl font-bold"
                              />
                              {suffix}
                            </span>
                          )
                        : (
                            <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">{item.stat}</span>
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
            Harvey AI is used by 50+ of the Am Law 200. Thomson Reuters integrated CoCounsel into
            Westlaw. Allen & Overy deployed Harvey firm-wide. The legal industry is moving fast.
          </p>
          <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
            "AI will not replace lawyers. But lawyers who use AI will replace lawyers who don't."
          </blockquote>
        </div>
      </div>
    </section>
  );
}

function StrategicAdvantagesSection() {
  const advantages = [
    {
      description: 'Review every contract in the queue with the same multi-perspective analysis. When 4 models work in parallel, no agreement gets a cursory skim because someone ran out of time.',
      icon: Icons.eye,
      number: '01',
      title: 'Full Coverage',
    },
    {
      description: 'Get contracts reviewed and redlined in minutes instead of days. Faster review means faster signatures and faster deals.',
      icon: Icons.zap,
      number: '02',
      title: 'Speed to Signature',
    },
    {
      description: 'No reviewer fatigue. No Friday-afternoon shortcuts. Every contract gets the same rigorous multi-perspective analysis whether it\'s the first or the fiftieth.',
      icon: Icons.checkCircle,
      number: '03',
      title: 'Consistency',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="A Legal Team That"
          headingHighlight="Never Gets Tired"
          description="The same rigor on the last contract of the quarter as the first."
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
      description: 'Every insight links to the model that produced it and the clause it analyzed. No black-box recommendations — every risk score has a reasoning trail.',
      icon: Icons.fileSearch,
      title: 'Full Traceability',
    },
    {
      description: 'Your documents stay private. API traffic is excluded from model training by our providers. All infrastructure runs on Cloudflare\'s encrypted global network.',
      icon: Icons.lock,
      title: 'Your Data Stays Yours',
    },
    {
      description: 'AI is the review team. You\'re the decision-maker. DebateKit accelerates your analysis — it doesn\'t replace your professional judgment.',
      icon: Icons.userCheck,
      title: 'Human-in-the-Loop',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Built for"
          headingHighlight="Confidential Legal Work"
          description="DebateKit is designed for confidential, high-stakes legal analysis — whether that's contract review, due diligence, or compliance assessment."
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
    description: 'AI-powered contract review and legal analysis with multiple AI models that debate clause risks, compliance gaps, IP exposure, and litigation liability. Built for law firms, general counsel, and corporate legal teams. Structured risk assessments in minutes, not hours.',
    name: 'DebateKit AI Legal Review',
    path: '/solutions/legal-review',
    price: 0,
  });

  const faqJsonLd = createFAQPageJsonLd(
    FAQ_ITEMS.map(f => ({ answer: f.answer, question: f.question })),
  );

  const breadcrumbJsonLd = createBreadcrumbListJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Solutions', path: '/solutions/legal-review' },
    { name: 'Legal Review', path: '/solutions/legal-review' },
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

export default function LegalReviewScreen() {
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
      <LegalReviewTeamSection />
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
      <SolutionLinksSection currentPath="/solutions/legal-review" />
      <SectionDivider />
      <BottomCTASection
        heading="Your AI Legal Review Team Is Ready"
        description="Assign the roles. Pick the models. Upload the contract. Whether it's vendor agreements, M&A due diligence, or compliance review — DebateKit makes sure nothing gets past you."
        ctaText="Start Your First DebateKit"
      />
    </LandingPageLayout>
  );
}
