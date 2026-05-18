'use client';

import { CardVariants } from '@debatekit/shared';

import { Icons } from '@/components/icons';
import { HealthcareConfigDemo } from '@/components/landing/healthcare-config-demo';
import { HealthcareHeroDemo } from '@/components/landing/healthcare-hero-demo';
import { LandingBrowserFrame } from '@/components/landing/landing-browser-frame';
import { BottomCTASection } from '@/components/landing/sections/bottom-cta-section';
import { FAQSection } from '@/components/landing/sections/faq-section';
import type { LandingFailure, LandingFAQItem, LandingMode, LandingPersona, LandingRole } from '@/components/landing/sections/landing-types';
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
    answer: 'Instead of one model producing a single diagnosis, multiple models analyze a case simultaneously — a Primary Care Physician generates the differential, a Specialist Consultant challenges it with domain expertise, a Pharmacist flags medication considerations, and an Evidence Reviewer anchors findings in published literature. Cross-examination between models catches anchoring bias and surfaces rare but important diagnoses.',
    question: 'How does multi-model AI improve clinical reasoning?',
  },
  {
    answer: 'Claude, GPT-4, Gemini, Grok, DeepSeek, and more. You choose which models participate in the consultation and what specialty each represents. Roles are fully configurable — assign "Primary Care Physician" to Claude, "Oncologist" to GPT-4, or any combination that fits your clinical workflow.',
    question: 'Which AI models does DebateKit use?',
  },
  {
    answer: 'No. DebateKit is an advisory and educational tool only. It does not replace clinical judgment, is not a medical device, and should not be used as a substitute for professional medical advice, diagnosis, or treatment. All clinical decisions must be made by qualified healthcare professionals. DebateKit provides structured multi-perspective reasoning to support — not replace — the clinician.',
    question: 'Does DebateKit replace clinical judgment?',
  },
  {
    answer: 'A typical clinical case analysis produces a structured differential diagnosis with evidence citations, workup recommendations, and treatment considerations in approximately 10-15 minutes. This includes multi-specialty perspectives, drug interaction checks, and guideline concordance review. The manual equivalent — consulting specialists, reviewing literature, checking interactions, and synthesizing everything — can take hours to days depending on case complexity and specialist availability.',
    question: 'How long does it take to analyze a clinical case?',
  },
  {
    answer: 'Your data stays private. All traffic is encrypted via HTTPS and our infrastructure runs on Cloudflare\'s global network. We route through API endpoints that are contractually excluded from model training by our providers. Case data is isolated per-workspace and never shared across accounts. For institutional use, we recommend using de-identified patient information.',
    question: 'Is my data secure?',
  },
  {
    answer: 'Absolutely. Clinical decision support is one use case. Teams use the same platform for M&A deal screening, investment analysis, legal review, strategic planning — any question that deserves more than one perspective. The multi-model deliberation works wherever rigorous analysis matters.',
    question: 'Can I use DebateKit for things other than clinical decision support?',
  },
  {
    answer: 'AI addresses the specialist access bottleneck — the reality that complex cases require multi-specialty input but specialist wait times average 3-4 weeks. With multi-model AI, clinicians get structured multi-specialty reasoning immediately. This supports better-informed initial workups, more targeted referrals, and stronger case preparation for tumor boards and clinical conferences.',
    question: 'How does AI improve clinical workflow?',
  },
  {
    answer: 'DebateKit is particularly valuable for tumor board preparation, complex diagnostic workups, treatment planning discussions, drug interaction reviews, and clinical case conferences. Any scenario where multiple specialties would normally weigh in benefits from AI multi-specialty consultation.',
    question: 'What types of clinical cases work best with DebateKit?',
  },
  {
    answer: 'Different tools for different workflows. Glass Health provides single-model differential diagnosis. UpToDate provides reference content and guidelines. Nuance DAX handles clinical documentation. DebateKit sits on top: the reasoning layer where you simulate multi-specialty consultation. These tools help you find information — DebateKit helps you think about it from multiple clinical perspectives. Reference Content → Multi-Specialty AI Consultation (DebateKit) → Clinical Decision.',
    question: 'How is DebateKit different from Glass Health, UpToDate, or Nuance?',
  },
  {
    answer: 'DebateKit is positioned as a clinical decision support tool, not a medical device. Under FDA guidance, software that provides recommendations for healthcare professionals to independently review is generally classified as non-device Clinical Decision Support (CDS). DebateKit does not make autonomous clinical decisions — it provides structured multi-perspective reasoning for clinicians to evaluate using their professional judgment.',
    question: 'What is the regulatory status of DebateKit?',
  },
] as const;

// ============================================================================
// MODE DATA
// ============================================================================

const MODES: readonly LandingMode[] = [
  {
    color: 'text-red-400',
    description: 'Models surface genuine disagreements about differential diagnosis and treatment approach.',
    icon: Icons.scale,
    title: 'Debating',
  },
  {
    color: 'text-blue-400',
    description: 'Models examine cases from different specialty angles, challenging each other\'s assessments.',
    icon: Icons.search,
    title: 'Analyzing',
  },
  {
    color: 'text-amber-400',
    description: 'Models explore creative diagnostic hypotheses and novel treatment combinations.',
    icon: Icons.lightbulb,
    title: 'Brainstorming',
  },
  {
    color: 'text-emerald-400',
    description: 'Models build toward actionable workup plans and evidence-based treatment recommendations.',
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
    description: 'Initial assessment, differential diagnosis generation, workup planning, and referral triage.',
    icon: Icons.userCheck,
    model: 'Claude',
    title: 'Primary Care Physician',
  },
  {
    color: 'text-blue-400',
    description: 'Domain-specific deep dive — cardiology, oncology, neurology, or any subspecialty your case requires.',
    icon: Icons.brain,
    model: 'GPT-4o',
    title: 'Specialist Consultant',
  },
  {
    color: 'text-purple-400',
    description: 'Drug interactions, dosing verification, contraindications, and medication reconciliation.',
    icon: Icons.package,
    model: 'Gemini',
    title: 'Pharmacist',
  },
  {
    color: 'text-amber-400',
    description: 'Literature search, clinical trial relevance, guideline concordance, and evidence grading.',
    icon: Icons.fileSearch,
    model: 'Grok',
    title: 'Evidence Reviewer',
  },
];

// ============================================================================
// PERSONA DATA
// ============================================================================

const PERSONAS: readonly LandingPersona[] = [
  {
    color: 'text-emerald-400',
    description: 'Tumor board prep takes hours. Complex cases need multi-specialty input but specialist access is limited. Diagnostic errors affect patient outcomes and create liability.',
    icon: Icons.briefcase,
    painPoint: 'Diagnostic error and specialist access',
    title: 'Hospital Systems',
  },
  {
    color: 'text-blue-400',
    description: '15-minute appointments to evaluate complex presentations. Specialist wait times average 3-4 weeks. Literature keeps expanding faster than any one person can track.',
    icon: Icons.userCheck,
    painPoint: 'Cognitive overload and time pressure',
    title: 'Clinicians',
  },
  {
    color: 'text-purple-400',
    description: 'Case-based learning requires showing how different specialists approach the same problem. Building realistic multi-perspective clinical scenarios is time-intensive.',
    icon: Icons.graduationCap,
    painPoint: 'Teaching clinical reasoning at scale',
    title: 'Medical Educators',
  },
  {
    color: 'text-amber-400',
    description: 'Literature synthesis across therapeutic areas takes days. Evidence evaluation requires checking multiple guidelines, meta-analyses, and clinical trial databases.',
    icon: Icons.fileSearch,
    painPoint: 'Literature synthesis bottleneck',
    title: 'Clinical Researchers',
  },
];

// ============================================================================
// SINGLE-MODEL FAILURE DATA
// ============================================================================

const SINGLE_MODEL_FAILURES: readonly LandingFailure[] = [
  {
    description: 'A single model anchors on the most likely diagnosis and fails to adequately weigh rare but dangerous alternatives. In clinical reasoning, the differential diagnosis exists precisely because anchoring kills — the zebra you didn\'t consider is the one that harms the patient.',
    icon: Icons.brain,
    number: '01',
    title: 'Anchoring Bias',
  },
  {
    description: 'LLMs fabricate study references, drug dosages, and guideline recommendations. In clinical contexts, a hallucinated drug interaction or fabricated contraindication doesn\'t just waste time — it can directly harm patients. Clinical reasoning demands verifiable, citation-backed evidence.',
    icon: Icons.alertTriangle,
    number: '02',
    title: 'Hallucinated Medical Citations',
  },
  {
    description: 'Complex presentations require simultaneous input from primary care, specialty medicine, pharmacology, and evidence-based medicine. A single model produces one perspective — but clinical reasoning requires the tension between specialties to surface the right diagnosis.',
    icon: Icons.layers,
    number: '03',
    title: 'Single-Specialty Blindness',
  },
];

// ============================================================================
// MARKET STATS DATA
// ============================================================================

const MARKET_STATS = [
  {
    label: 'Americans affected by diagnostic errors annually',
    prefix: '',
    source: 'BMJ Quality & Safety',
    suffix: 'M',
    value: 12,
  },
  {
    label: 'of physicians believe AI will be part of clinical practice within 5 years',
    prefix: '',
    source: 'AMA Physician Survey',
    suffix: '%',
    value: 86,
  },
  {
    decimalPlaces: 1,
    label: 'projected clinical AI market size by 2028',
    prefix: '$',
    source: 'MarketsandMarkets',
    suffix: 'B',
    value: 22.4,
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
            Your AI Clinical Consultation
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
          Never diagnose on one AI's opinion
        </TextAnimate>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          DebateKit forces AI to challenge AI on your clinical case — one generates the
          differential, another stress-tests it, while pharmacology and evidence reviewers flag
          what others miss. Multi-specialty peer review in minutes, not weeks.
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
              <HealthcareHeroDemo />
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
          heading="One Case."
          headingHighlight="Every Specialty Heard."
          description="Unlike single-model AI, DebateKit runs multiple models in parallel — and they can see and challenge each other's clinical reasoning."
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
          You choose the mode. You assign the specialties. The models do the rest — and a Council
          Moderator synthesizes the consensus at the end.
        </p>
      </div>
    </section>
  );
}

function WorkflowGapSection() {
  const stages = [
    { highlight: false, label: 'Reference Content', status: 'Solved', tools: 'UpToDate, PubMed, DynaMed' },
    { highlight: true, label: 'Clinical Reasoning', status: 'The Bottleneck', tools: 'Manual. Hours to days per complex case.' },
    { highlight: false, label: 'Documentation', status: 'Solved', tools: 'Nuance DAX, Epic, Cerner' },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Use Case"
          heading="Clinical Reasoning Is"
          headingHighlight="the Bottleneck"
          description="UpToDate gives you the guidelines. PubMed gives you the literature. But the critical reasoning layer — synthesizing symptoms, differentials, drug interactions, and evidence into a clinical plan? That still happens in the clinician's head, alone."
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
            <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">12 million</span>
            {' diagnostic errors '}
            <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">every year</span>
            {' in the US alone.'}
          </p>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Complex cases need multi-specialty input. But specialist wait times average 3-4 weeks,
            and clinicians have 15 minutes per appointment. The math doesn't work.
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
          heading="Built for Clinicians Who Need"
          headingHighlight="Answers Now"
          description="Whether you're preparing for tumor board, working up a complex case, or teaching clinical reasoning — the need is the same: multi-specialty perspective, fast."
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
          heading="Why Asking ChatGPT for a Diagnosis"
          headingHighlight="Doesn't Work"
          description="Generic AI can list symptoms. But clinical reasoning demands adversarial differential thinking, evidence grading, and multi-specialty challenge that a single model cannot deliver."
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
          DebateKit fixes this. When a Primary Care Physician and Specialist Consultant debate the
          same case — and a Pharmacist and Evidence Reviewer add context — anchoring bias gets
          caught, citations get verified, and the differential gets stress-tested.
        </p>
      </div>
    </section>
  );
}

function WhyMultipleModelsSection() {
  const advantages = [
    {
      description: 'When the PCP anchors on lymphoma, the Specialist can push for myeloma workup. When both miss a medication interaction, the Pharmacist catches it. Anchoring bias doesn\'t survive multi-specialty cross-examination.',
      icon: Icons.shieldAlert,
      title: 'Cross-Specialty Challenge Saves Lives',
    },
    {
      description: 'A symptom cluster means different things to different specialties. When primary care, specialty, pharmacology, and evidence-based medicine perspectives all weigh in, the picture becomes three-dimensional.',
      icon: Icons.eye,
      title: 'Multiple Specialties, Full Picture',
    },
    {
      description: 'Symptoms, labs, medications, and guidelines need cross-referencing. When models respond to each other, they naturally connect dots across clinical domains that siloed reasoning misses.',
      icon: Icons.layers,
      title: 'Synthesis Through Consultation',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Multiple Specialists Catch"
          headingHighlight="What One Misses"
          description="A single AI gives you a diagnosis. But when Primary Care, Specialist, Pharmacist, and Evidence Reviewer models debate the same case — anchoring bias gets caught, rare diagnoses get considered, and drug interactions get flagged."
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

function ClinicalConsultationSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Configurable Specialties"
          heading="Assign Specialties."
          headingHighlight="Start the Consultation."
          description="In DebateKit, you pick the AI models and assign each one a medical specialty — just like convening a real clinical consultation. Here's a setup clinicians use for complex cases:"
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
          <BlurFade delay={0.1} inView>
            <div className="max-w-4xl mx-auto">
              <LandingBrowserFrame>
                <HealthcareConfigDemo />
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
    'Patient presents with complex symptoms (15-minute visit)',
    'Review history, order initial labs (30-60 minutes)',
    'Consult specialists — wait 3-4 weeks for availability',
    'Literature review for differential (1-2 hours)',
    'Synthesize findings and finalize treatment plan (variable)',
  ];

  const debatekitSteps = [
    'Describe the case presentation and relevant history',
    'AI specialists analyze in parallel — each from their domain',
    'Council Moderator synthesizes consensus with evidence citations',
    'You review the reasoning and make clinical decisions',
  ];

  return (
    <section id="how-it-works" className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Weeks of Specialist Access"
          headingHighlight="Minutes of AI Consultation"
          headingSuffix="."
          description="From case presentation to structured multi-specialty reasoning."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card variant={CardVariants.GLASS_SUBTLE}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="secondary">Manual</Badge>
                <span className="text-sm font-medium text-destructive/70">Days to Weeks</span>
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
                <span className="text-sm font-medium text-emerald-400">~10 Minutes</span>
              </div>
              <ol className="space-y-4">
                {debatekitSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <MotionSpan
                      className="flex-shrink-0 size-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary"
                      initial={subtleFade.hidden}
                      whileInView={subtleFade.visible}
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
          heading="Clinical AI Has Reached an"
          headingHighlight="Inflection Point"
          description="Google's Med-PaLM 2 achieved expert-level performance on medical exams. Glass Health raised $17M for AI differential diagnosis. The clinical AI market is accelerating."
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
                key={item.value}
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
                      <span className="bg-gradient-to-r from-teal-400 to-emerald-300 bg-clip-text text-transparent">
                        {item.prefix}
                        <NumberTicker
                          value={item.value}
                          decimalPlaces={'decimalPlaces' in item ? item.decimalPlaces : 0}
                          className="bg-gradient-to-r from-teal-400 to-emerald-300 bg-clip-text text-transparent text-4xl sm:text-5xl font-bold"
                        />
                        {item.suffix}
                      </span>
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
            Mayo Clinic, Johns Hopkins, and Mount Sinai are deploying AI clinical decision support.
            The American Medical Association reports that 86% of physicians expect AI to be part of
            clinical practice within 5 years.
          </p>
          <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
            "AI will not replace physicians. But physicians who use AI will replace physicians who don't."
          </blockquote>
        </div>
      </div>
    </section>
  );
}

function StrategicAdvantagesSection() {
  const advantages = [
    {
      description: 'Get structured multi-specialty reasoning for every complex case. When 4 AI specialists work in parallel, no diagnosis goes unchallenged.',
      icon: Icons.eye,
      number: '01',
      title: 'Complete Differential',
    },
    {
      description: 'Multi-specialty AI consultation in minutes, not weeks. Immediate structured reasoning supports faster workups and more targeted referrals.',
      icon: Icons.zap,
      number: '02',
      title: 'Speed to Diagnosis',
    },
    {
      description: 'Every case gets the same multi-specialty rigor — whether it\'s the first patient of the day or the last. No cognitive fatigue, no anchoring drift.',
      icon: Icons.checkCircle,
      number: '03',
      title: 'Consistent Reasoning',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="A Consultation Team That"
          headingHighlight="Never Gets Tired"
          description="The same rigor on the last patient as the first."
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
      description: 'Every insight links to the model that produced it and the evidence it cited. No black-box diagnoses — every recommendation has a reasoning trail.',
      icon: Icons.fileSearch,
      title: 'Full Traceability',
    },
    {
      description: 'Your data stays private. API traffic is excluded from model training by our providers. All infrastructure runs on Cloudflare\'s encrypted global network. Use de-identified data for maximum privacy.',
      icon: Icons.lock,
      title: 'Your Data Stays Yours',
    },
    {
      description: 'AI is the consultation team. You\'re the clinician. DebateKit provides structured reasoning to support your judgment — it never makes autonomous clinical decisions.',
      icon: Icons.userCheck,
      title: 'Human-in-the-Loop',
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Built for"
          headingHighlight="Clinical Confidence"
          description="DebateKit is designed for high-stakes clinical reasoning — where every recommendation must be traceable, evidence-based, and ultimately validated by a qualified clinician."
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
                    DebateKit is an advisory and educational tool. It does not replace clinical judgment, is not a medical
                    device, and should not be used as a substitute for professional medical advice, diagnosis, or treatment.
                    All clinical decisions must be made by qualified healthcare professionals.
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
    description: 'AI-powered clinical decision support with multiple AI models that simulate multi-specialty consultation. Differential diagnosis, treatment planning, drug interaction review, and evidence-based reasoning. Built for clinicians, hospital systems, and medical educators.',
    name: 'DebateKit AI Clinical Decision Support',
    path: '/solutions/healthcare-clinical',
    price: 0,
  });

  const faqJsonLd = createFAQPageJsonLd(
    FAQ_ITEMS.map(f => ({ answer: f.answer, question: f.question })),
  );

  const breadcrumbJsonLd = createBreadcrumbListJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Solutions', path: '/solutions/healthcare-clinical' },
    { name: 'Healthcare Clinical', path: '/solutions/healthcare-clinical' },
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

export default function HealthcareClinicalScreen() {
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
      <ClinicalConsultationSection />
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
      <SolutionLinksSection currentPath="/solutions/healthcare-clinical" />
      <SectionDivider />
      <BottomCTASection
        heading="Your AI Clinical Consultation Is Ready"
        description="Assign the specialties. Pick the models. Describe the case. Whether it's differential diagnosis, treatment planning, or any clinical question that deserves more than one perspective — DebateKit makes sure nothing gets missed."
        ctaText="Start Your First DebateKit"
      />
    </LandingPageLayout>
  );
}
