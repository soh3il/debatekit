'use client';

import { CardVariants } from '@debatekit/shared';

import { Icons } from '@/components/icons';
import { LandingBrowserFrame } from '@/components/landing/landing-browser-frame';
import { MultiAgentDebateConfigDemo } from '@/components/landing/multi-agent-debate-config-demo';
import { MultiAgentDebateHeroDemo } from '@/components/landing/multi-agent-debate-hero-demo';
import { BottomCTASection } from '@/components/landing/sections/bottom-cta-section';
import { ComparisonStepsSection } from '@/components/landing/sections/comparison-steps-section';
import { FailureGridSection } from '@/components/landing/sections/failure-grid-section';
import { FAQSection } from '@/components/landing/sections/faq-section';
import { FeatureCardGridSection } from '@/components/landing/sections/feature-card-grid-section';
import type { LandingFailure, LandingFAQItem, LandingFeatureCard, LandingPersona, LandingRole } from '@/components/landing/sections/landing-types';
import { ModesGridSection } from '@/components/landing/sections/modes-grid-section';
import { PersonaGridSection } from '@/components/landing/sections/persona-grid-section';
import { ResearchFoundationCallout } from '@/components/landing/sections/research-foundation-callout';
import { SHARED_RESEARCH_STATS } from '@/components/landing/sections/research-stats';
import { RoleGridSection } from '@/components/landing/sections/role-grid-section';
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
    answer:
      'Multi-agent debate (MAD) is a technique where multiple AI models discuss the same question, challenging and refining each other\'s responses through structured rounds of deliberation. Unlike single-model prompting, MAD produces adversarial cross-examination that catches errors, hallucinations, and blind spots. Validated at ICML 2024, NeurIPS 2024, and ICLR 2025.',
    question: 'What is multi-agent debate?',
  },
  {
    answer:
      'Chain-of-thought is single-model internal reasoning \u2014 one model talking to itself. Multi-agent debate is multi-model external reasoning \u2014 different models with different training data challenge each other\'s conclusions. Research shows CoT alone is prone to confabulation, while MAD on top of CoT catches the errors that internal reasoning misses.',
    question: 'How does multi-agent debate compare to chain-of-thought prompting?',
  },
  {
    answer:
      'Not unconditionally. Research shows consistent improvement on tasks involving reasoning, factual accuracy, and complex analysis. Simple factual lookups benefit less. The more ambiguous the question, the more debate helps. Khan et al. (ICML 2024) showed +28 percentage points on complex reasoning tasks.',
    question: 'Does multi-agent debate always improve accuracy?',
  },
  {
    answer:
      'Multi-agent debate uses more tokens than a single query \u2014 typically 3-5x depending on the number of models and rounds. The trade-off is accuracy vs cost, and for high-stakes decisions where getting the wrong answer is expensive, the accuracy gain justifies the investment.',
    question: 'What about token cost for multi-agent debate?',
  },
  {
    answer:
      'Heterogeneous councils (mixing different model families like Claude, GPT-4, Gemini, Grok) outperform homogeneous ones. Research shows that diversity in training data and model architecture produces the strongest debates and the most reliable conclusions.',
    question: 'Which AI models work best for multi-agent debate?',
  },
  {
    answer:
      'Traditional ensembles vote independently \u2014 models never see each other\'s responses. Multi-agent debate is interactive: models read and respond to each other\'s arguments, building understanding through adversarial exchange rather than parallel aggregation. This is why MAD catches errors that ensemble voting misses.',
    question: 'How is multi-agent debate different from ensemble methods?',
  },
  {
    answer:
      'Yes. Multi-agent debate is especially effective for architecture decisions, code review, security analysis, investment research, legal review, and any technical decision with trade-offs. Each model can be assigned a different review perspective \u2014 Systems Architect, Security Reviewer, Performance Engineer, etc.',
    question: 'Can I use multi-agent debate for code review and architecture decisions?',
  },
  {
    answer:
      'Yes. DebateKit\'s MCP server integrates with Claude Code, Cursor, Windsurf, and any MCP-compatible client. Run multi-agent debates without leaving your editor \u2014 one config line is all it takes.',
    question: 'Can I run multi-agent debates in my IDE?',
  },
  {
    answer:
      'Your data stays private. All traffic is encrypted via HTTPS on Cloudflare\'s global network. API endpoints are contractually excluded from model training by our providers. Debate sessions are isolated per-workspace and never shared across accounts.',
    question: 'Is my data secure during multi-agent debates?',
  },
  {
    answer:
      'DebateKit provides four deliberation modes: Debating (adversarial challenge), Analyzing (multi-perspective examination), Brainstorming (collaborative idea generation), and Problem Solving (convergent solution building). Choose the mode that fits your question.',
    question: 'What deliberation modes are available for multi-agent debate?',
  },
] as const;

// ============================================================================
// PERSONA DATA
// ============================================================================

const PERSONAS: readonly LandingPersona[] = [
  {
    color: 'text-blue-400',
    description:
      'You need to validate findings, challenge hypotheses, and identify methodology flaws before publication. Multi-agent debate provides the adversarial review your work needs.',
    icon: Icons.search,
    painPoint: 'Validating research without peer review bottlenecks',
    title: 'AI Researchers',
  },
  {
    color: 'text-indigo-400',
    description:
      'Architecture decisions, technology selection, code review \u2014 every choice has trade-offs. Multi-agent debate surfaces the arguments your team would have, but faster.',
    icon: Icons.layers,
    painPoint: 'Technical decisions with hidden complexity',
    title: 'Engineering Teams',
  },
  {
    color: 'text-amber-400',
    description:
      'Investment theses, market analysis, due diligence \u2014 you need adversarial challenge, not agreement. Multi-agent debate runs bull vs bear so you see both sides.',
    icon: Icons.trendingUp,
    painPoint: 'Analysis that needs adversarial stress-testing',
    title: 'Analysts & Researchers',
  },
  {
    color: 'text-purple-400',
    description:
      'Strategic direction, resource allocation, market entry \u2014 decisions where one perspective isn\'t enough. Multi-agent debate gives you the council your board would provide.',
    icon: Icons.briefcase,
    painPoint: 'Strategic decisions requiring diverse perspectives',
    title: 'Decision Makers',
  },
];

// ============================================================================
// SINGLE-MODEL FAILURE DATA
// ============================================================================

const SINGLE_MODEL_FAILURES: readonly LandingFailure[] = [
  {
    description:
      'A single model generates one answer and has no mechanism to challenge itself. Research shows this leads to confident-sounding but unchecked responses. Multi-agent debate forces models to defend their positions against adversarial counter-arguments.',
    icon: Icons.brain,
    number: '01',
    title: 'No Self-Correction Mechanism',
  },
  {
    description:
      'When a model hallucinates a citation or fabricates a statistic, there\'s no second model to catch it. In multi-agent debate, every claim gets cross-examined by models with different knowledge bases \u2014 fabrications don\'t survive the scrutiny.',
    icon: Icons.alertTriangle,
    number: '02',
    title: 'Hallucinations Go Unchallenged',
  },
  {
    description:
      'Single models optimize for confident, coherent answers \u2014 not accuracy. They present one narrative and suppress the tensions and trade-offs. Multi-agent debate makes trade-offs explicit because models with different perspectives surface them naturally.',
    icon: Icons.layers,
    number: '03',
    title: 'Confidence Without Calibration',
  },
];

// ============================================================================
// ROLE DATA
// ============================================================================

const ROLES: readonly LandingRole[] = [
  {
    color: 'text-blue-400',
    description: 'Deep analysis of research papers, data, and evidence. Grounds the debate in verifiable findings and identifies knowledge gaps.',
    icon: Icons.search,
    model: 'Claude',
    title: 'Research Analyst',
  },
  {
    color: 'text-red-400',
    description: 'Challenges every claim and assumption. Stress-tests arguments by arguing the opposing position with evidence.',
    icon: Icons.shieldAlert,
    model: 'GPT-4',
    title: 'Devil\'s Advocate',
  },
  {
    color: 'text-amber-400',
    description: 'Evaluates methodology, identifies confounders, and ensures conclusions follow from evidence. Catches logical gaps.',
    icon: Icons.eye,
    model: 'Gemini',
    title: 'Methodology Expert',
  },
  {
    color: 'text-emerald-400',
    description: 'Grounds theoretical arguments in real-world implementation. Bridges the gap between research findings and practical application.',
    icon: Icons.wrench,
    model: 'Grok',
    title: 'Practitioner',
  },
];

// ============================================================================
// WHY DEBATE WORKS DATA
// ============================================================================

const WHY_DEBATE_WORKS: readonly LandingFeatureCard[] = [
  {
    color: 'text-blue-400',
    description:
      'Each model was trained on different data with different objectives. Their disagreements reveal where knowledge gaps hide \u2014 and those gaps are exactly where single-model answers go wrong.',
    icon: Icons.database,
    title: 'Diverse Training Data',
  },
  {
    color: 'text-red-400',
    description:
      'When models must defend positions against counterarguments, hallucinations collapse. Weak reasoning doesn\'t survive adversarial pressure from models with different knowledge bases.',
    icon: Icons.shieldAlert,
    title: 'Adversarial Pressure',
  },
  {
    color: 'text-emerald-400',
    description:
      'Multi-round deliberation lets models build on each other\'s insights. Each round sharpens the reasoning, catches errors, and converges toward more reliable conclusions.',
    icon: Icons.layers,
    title: 'Iterative Refinement',
  },
];

// ============================================================================
// INTEGRATION DATA
// ============================================================================

const INTEGRATIONS: readonly LandingFeatureCard[] = [
  {
    color: 'text-emerald-400',
    description:
      'One config line. Multi-model deliberation in Claude Code, Cursor, Windsurf, and any MCP client. Multi-agent debate without leaving your editor.',
    icon: Icons.terminal,
    title: 'MCP Server',
  },
  {
    color: 'text-blue-400',
    description:
      'Full-featured web UI with real-time streaming, session history, and team collaboration. Watch the debate unfold in real time.',
    icon: Icons.layers,
    title: 'Web Platform',
  },
  {
    color: 'text-amber-400',
    description:
      'Programmatic access to multi-agent debate. Build deliberation into your own tools, CI/CD pipelines, and automated workflows.',
    icon: Icons.zap,
    title: 'API Access',
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
            From Research to Production
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
          Multi-agent debate, validated and ready to use
        </TextAnimate>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          The research is clear &mdash; when AI models debate, accuracy improves by +28
          percentage points. DebateKit brings multi-agent debate from ICML papers to your
          workflow.
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
            <MultiAgentDebateHeroDemo />
          </LandingBrowserFrame>
        </BlurFade>
      </div>
    </section>
  );
}

function ResearchOverviewSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Research"
          heading="The Science Behind"
          headingHighlight="Multi-Agent Debate"
          description="Three landmark papers established that AI models produce better answers when they argue. These aren't theoretical claims — they're peer-reviewed findings from ICML, ICLR, and NeurIPS."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SHARED_RESEARCH_STATS.map((item, i) => {
            const isCenter = i === 1;
            const is28pp = item.stat === '+28pp';
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
                  {is28pp
                    ? (
                        <span className="text-4xl sm:text-5xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
                          +
                          <NumberTicker
                            value={28}
                            className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent"
                          />
                          pp
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
      </div>
    </section>
  );
}

// ============================================================================
// JSON-LD DATA
// ============================================================================

function JsonLdScripts() {
  const productJsonLd = createProductJsonLd({
    description:
      'Multi-agent debate platform where AI models argue, challenge, and refine each other\'s reasoning. Validated by ICML 2024 (+28pp accuracy), ICLR 2025, and NeurIPS research. Built for research validation, architecture decisions, investment analysis, and any high-stakes decision requiring accuracy beyond single-model capability.',
    name: 'DebateKit Multi-Agent Debate',
    path: '/solutions/multi-agent-debate',
    price: 0,
  });

  const faqJsonLd = createFAQPageJsonLd(
    FAQ_ITEMS.map(f => ({ answer: f.answer, question: f.question })),
  );

  const breadcrumbJsonLd = createBreadcrumbListJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Solutions', path: '/solutions/multi-agent-debate' },
    { name: 'Multi-Agent Debate', path: '/solutions/multi-agent-debate' },
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

export default function MultiAgentDebateScreen() {
  return (
    <LandingPageLayout>
      <JsonLdScripts />
      <HeroSection />
      <SectionDivider />
      <ResearchOverviewSection />
      <SectionDivider />
      <FeatureCardGridSection
        heading="Why Models Produce Better Answers"
        headingHighlight="When They Argue"
        description="Multi-agent debate isn't just multiple opinions — it's adversarial cross-examination that eliminates the failure modes of single-model AI."
        items={WHY_DEBATE_WORKS}
      />
      <SectionDivider />
      <PersonaGridSection
        heading="Built for Anyone Who Needs"
        headingHighlight="Reliable AI Reasoning"
        description="If you've ever gotten a confidently wrong answer from ChatGPT, you understand why multi-agent debate matters. These are the teams seeing the biggest impact."
        personas={PERSONAS}
      />
      <SectionDivider />
      <FailureGridSection
        heading="Why ChatGPT Alone Isn't Enough for"
        headingHighlight="High-Stakes Decisions"
        description="A single AI model is like consulting one expert who never gets challenged. For questions where accuracy matters, that's not good enough."
        items={SINGLE_MODEL_FAILURES}
        footer={(
          <>
            Multi-agent debate solves this. When a Research Analyst and Devil&apos;s Advocate examine
            the same claim — and a Methodology Expert checks the reasoning — hallucinations get
            caught, weak arguments collapse, and the trade-offs become visible.
          </>
        )}
      />
      <SectionDivider />
      <RoleGridSection
        heading="Assign Roles."
        headingHighlight="Start the Debate."
        description="In DebateKit, you pick the AI models and assign each one a role \u2014 just like assembling a debate panel. Here's a setup teams use for research validation:"
        roles={ROLES}
        configDemo={<MultiAgentDebateConfigDemo />}
      />
      <SectionDivider />
      <ComparisonStepsSection
        label="Implementation"
        heading="From Research Paper to"
        headingHighlight="Production Workflow"
        description="Most multi-agent debate research uses homogeneous agents in controlled settings. DebateKit brings it to real-world decisions with heterogeneous models and structured deliberation modes."
        manual={{
          badge: 'Single Model',
          label: 'No Debate',
          steps: [
            'Ask ChatGPT. Get one answer with no adversarial challenge.',
            'Maybe try Claude or Gemini too. Compare answers manually.',
            'No cross-examination \u2014 models never see each other\'s responses.',
            'Trust whichever answer sounds most confident.',
          ],
        }}
        debatekit={{
          badge: 'Multi-Agent Debate',
          label: '+28pp Accuracy',
          steps: [
            'Choose your models and assign debate roles',
            'Models respond sequentially, reading and challenging each other',
            'Adversarial pressure eliminates hallucinations and weak reasoning',
            'Council Moderator synthesizes consensus, dissent, and actionable insight',
          ],
        }}
      />
      <SectionDivider />
      <ModesGridSection footer="Each mode shapes the deliberation differently &mdash; choose based on your question." />
      <ResearchFoundationCallout />
      <SectionDivider />
      <FeatureCardGridSection
        label="Integration"
        heading="Use Multi-Agent Debate"
        headingHighlight="Where You Work"
        items={INTEGRATIONS}
      />
      <SectionDivider />
      <FAQSection items={FAQ_ITEMS} variant="card" />
      <SectionDivider />
      <SolutionLinksSection currentPath="/solutions/multi-agent-debate" />
      <SectionDivider />
      <BottomCTASection
        heading="Try Multi-Agent Debate Free"
        description="The research is clear. Models produce better answers when they argue. Start your first multi-agent debate and see the difference structured deliberation makes."
        ctaText="Get Started Free"
      />
    </LandingPageLayout>
  );
}
