'use client';

import { CardVariants } from '@debatekit/shared';

import { Icons } from '@/components/icons';
import { LandingBrowserFrame } from '@/components/landing/landing-browser-frame';
import { LlmCouncilConfigDemo } from '@/components/landing/llm-council-config-demo';
import { LlmCouncilHeroDemo } from '@/components/landing/llm-council-hero-demo';
import { BottomCTASection } from '@/components/landing/sections/bottom-cta-section';
import { ComparisonStepsSection } from '@/components/landing/sections/comparison-steps-section';
import { FailureGridSection } from '@/components/landing/sections/failure-grid-section';
import { FAQSection } from '@/components/landing/sections/faq-section';
import { FeatureCardGridSection } from '@/components/landing/sections/feature-card-grid-section';
import type { LandingFailure, LandingFAQItem, LandingFeatureCard, LandingPersona, LandingRole } from '@/components/landing/sections/landing-types';
import { ModesGridSection } from '@/components/landing/sections/modes-grid-section';
import { MotionDiv, quickTransition, subtleFade, VIEWPORT_ONCE } from '@/components/landing/sections/motion-variants';
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
      'An LLM council is a setup where multiple AI models are queried on the same question, and their responses are compared or deliberated over. The concept originated from Andrej Karpathy\'s idea of using a "council" of LLMs to get better reasoning and reduce blind spots from any single model.',
    question: 'What is an LLM council?',
  },
  {
    answer:
      'Karpathy\'s original concept is parallel querying \u2014 ask multiple models the same question and compare outputs side by side. DebateKit adds sequential deliberation: each model reads and challenges previous responses. On top of that, DebateKit provides structured modes (Debating, Analyzing, Brainstorming, Problem Solving), role-based personas, and a Council Moderator that synthesizes the final verdict.',
    question: 'How is DebateKit different from Karpathy\'s LLM council?',
  },
  {
    answer:
      'Up to 8 models per session. Choose from Claude, GPT-4, Gemini, Grok, DeepSeek, and more. Each model can be assigned a different role to bring a unique perspective to the deliberation.',
    question: 'How many models can participate in a council?',
  },
  {
    answer:
      'Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google), Grok (xAI), DeepSeek, and more. New models are added regularly as the landscape evolves.',
    question: 'What models are supported?',
  },
  {
    answer:
      'Free tier available with limited sessions. Pro plans start at $20/month for unlimited deliberations. You can bring your own API keys or use our hosted models.',
    question: 'How much does it cost?',
  },
  {
    answer:
      'Yes. DebateKit\'s MCP server integrates with Claude Code, Cursor, Windsurf, and any MCP-compatible client. Run council deliberations without leaving your editor.',
    question: 'Can I use it in my IDE?',
  },
  {
    answer:
      'Research says yes. Khan et al. (ICML 2024 Best Paper) showed that multi-model debate improves accuracy by +28 percentage points. Wang et al. (ICLR 2025) demonstrated that open-source models collaborating via structured debate outperform GPT-4o acting alone.',
    question: 'Is multi-model debate actually better than a single model?',
  },
  {
    answer:
      'LLM councils are especially effective for architecture decisions, investment analysis, legal review, research validation, and any decision where trade-offs exist. The more ambiguous the question, the more the council reveals perspectives a single model would miss.',
    question: 'What types of decisions work best with an LLM council?',
  },
  {
    answer:
      'Completely. Assign any role to any model \u2014 Systems Architect, Devil\'s Advocate, Risk Assessor, Domain Expert, or any custom role. Different questions benefit from different council compositions.',
    question: 'Can I customize the council roles?',
  },
  {
    answer:
      'Your data stays private. All traffic is encrypted via HTTPS and our infrastructure runs on Cloudflare\'s global network. API endpoints are contractually excluded from model training by our providers. Council sessions are isolated per-workspace.',
    question: 'Is my data secure during council deliberations?',
  },
] as const;

// ============================================================================
// CONCEPT DATA
// ============================================================================

const COUNCIL_PRINCIPLES: readonly LandingFeatureCard[] = [
  {
    color: 'text-blue-400',
    description:
      'Different models have different training data, different strengths, and different blind spots. Querying multiple models surfaces perspectives no single model would produce.',
    icon: Icons.eye,
    title: 'Diverse Perspectives',
  },
  {
    color: 'text-red-400',
    description:
      'Models read and challenge each other\'s reasoning, exposing weak arguments, unsupported claims, and confirmation bias before they reach your decision.',
    icon: Icons.shieldAlert,
    title: 'Adversarial Challenge',
  },
  {
    color: 'text-emerald-400',
    description:
      'A Council Moderator reads all positions and produces a structured synthesis \u2014 consensus points, disagreements, trade-offs, and a final verdict.',
    icon: Icons.checkCircle,
    title: 'Synthesized Verdict',
  },
];

// ============================================================================
// DELIBERATION ADVANTAGES DATA
// ============================================================================

const DELIBERATION_ADVANTAGES: readonly LandingFeatureCard[] = [
  {
    color: 'text-amber-400',
    description:
      'When models must respond to disagreement, confirmation bias collapses. No more "yes-and" responses \u2014 every claim gets tested.',
    icon: Icons.alertTriangle,
    title: 'Echo Chambers Break',
  },
  {
    color: 'text-blue-400',
    description:
      'Cross-verification between models catches fabricated citations, incorrect facts, and unsupported claims before they reach your decision.',
    icon: Icons.search,
    title: 'Hallucinations Get Caught',
  },
  {
    color: 'text-purple-400',
    description:
      'Structured debate forces models to defend positions with evidence. Weak arguments don\'t survive adversarial pressure.',
    icon: Icons.brain,
    title: 'Reasoning Sharpens',
  },
];

// ============================================================================
// PERSONA DATA
// ============================================================================

const PERSONAS: readonly LandingPersona[] = [
  {
    color: 'text-blue-400',
    description:
      'You need to validate findings across multiple perspectives before publishing. A single model gives you one interpretation — a council gives you the debate your reviewers would.',
    icon: Icons.search,
    painPoint: 'Single-perspective research validation',
    title: 'Researchers & Analysts',
  },
  {
    color: 'text-indigo-400',
    description:
      'Architecture decisions, build-vs-buy, technology selection — every decision has trade-offs that one model glosses over. Your council surfaces the arguments before they become production incidents.',
    icon: Icons.layers,
    painPoint: 'Architecture decisions with hidden trade-offs',
    title: 'Engineering Leads',
  },
  {
    color: 'text-purple-400',
    description:
      'Feature prioritization, market positioning, pricing strategy. When you ask one AI, you get one opinion dressed as a recommendation. A council gives you the full debate.',
    icon: Icons.briefcase,
    painPoint: 'Strategic decisions that need multiple viewpoints',
    title: 'Product Teams',
  },
  {
    color: 'text-amber-400',
    description:
      'Due diligence, risk assessment, market analysis. You need adversarial challenge, not agreement. Your council plays bull case vs bear case so you don\'t have to guess which one GPT was trained on.',
    icon: Icons.trendingUp,
    painPoint: 'Investment decisions needing adversarial analysis',
    title: 'Investment Analysts',
  },
];

// ============================================================================
// SINGLE-MODEL FAILURE DATA
// ============================================================================

const SINGLE_MODEL_FAILURES: readonly LandingFailure[] = [
  {
    description:
      'A single model has one training distribution, one set of biases, and one perspective. It produces one confident answer and has no mechanism to challenge itself. LLM councils break this by forcing multiple models with different training data to argue the same question.',
    icon: Icons.brain,
    number: '01',
    title: 'Echo Chamber of One',
  },
  {
    description:
      'When you ask ChatGPT a question, there\'s no second model fact-checking the response. Hallucinations, fabricated citations, and unsupported claims go unchallenged. In a council, every claim gets tested by models with different knowledge bases.',
    icon: Icons.alertTriangle,
    number: '02',
    title: 'No Cross-Verification',
  },
  {
    description:
      'Complex decisions involve security, performance, cost, compliance, and team dynamics simultaneously. A single model produces one coherent narrative but misses the tensions between dimensions. Council deliberation surfaces these tensions explicitly.',
    icon: Icons.layers,
    number: '03',
    title: 'Single-Dimension Reasoning',
  },
];

// ============================================================================
// ROLE DATA
// ============================================================================

const ROLES: readonly LandingRole[] = [
  {
    color: 'text-indigo-400',
    description: 'System design, service boundaries, data flow, and long-term architectural sustainability. Evaluates structural trade-offs.',
    icon: Icons.layers,
    model: 'Claude',
    title: 'Systems Architect',
  },
  {
    color: 'text-red-400',
    description: 'Latency analysis, throughput modeling, resource optimization, and scalability assessment under production load.',
    icon: Icons.zap,
    model: 'GPT-4',
    title: 'Scalability Engineer',
  },
  {
    color: 'text-amber-400',
    description: 'Attack surface analysis, compliance implications, data protection boundaries, and authentication architecture.',
    icon: Icons.shieldCheck,
    model: 'Gemini',
    title: 'Security Reviewer',
  },
  {
    color: 'text-emerald-400',
    description: 'Operational complexity, team capacity, timeline constraints, migration risk, and real-world deployment feasibility.',
    icon: Icons.wrench,
    model: 'Grok',
    title: 'Pragmatist',
  },
];

// ============================================================================
// COMPARISON DATA
// ============================================================================

const COMPARISON_FEATURES = [
  'Sequential deliberation',
  'Structured modes',
  'Role-based personas',
  'Moderator synthesis',
  'MCP integration',
  'Research-validated',
] as const;

const COMPARISON_TOOLS = [
  {
    features: [true, true, true, true, true, true],
    highlight: true,
    name: 'DebateKit',
  },
  {
    features: [false, false, false, false, false, false],
    highlight: false,
    name: 'Raw LLM Council',
  },
  {
    features: [false, false, false, false, false, false],
    highlight: false,
    name: 'ChatHub / TypingMind',
  },
  {
    features: [true, false, false, false, false, false],
    highlight: false,
    name: 'Council AI',
  },
] as const;

// ============================================================================
// HELPERS
// ============================================================================

function parseSingleNumber(stat: string): number | null {
  const match = stat.match(/^(\d+)%$/);
  return match ? Number(match[1]) : null;
}

// ============================================================================
// SECTION COMPONENTS (page-specific only)
// ============================================================================

function HeroSection() {
  return (
    <section className="relative py-12 sm:py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
        <div>
          <Badge variant="glass" className="mb-6">
            <Icons.sparkles className="size-3" />
            The LLM Council, Built for Production
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
          Your AI council is ready to deliberate
        </TextAnimate>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          DebateKit is Karpathy&apos;s LLM council concept made real. Multiple AI models
          deliberate, challenge, and synthesize &mdash; not just compare. Research-validated
          at ICML 2024, built for production decisions.
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
            <LlmCouncilHeroDemo />
          </LandingBrowserFrame>
        </BlurFade>
      </div>
    </section>
  );
}

function WorkflowGapSection() {
  const stages = [
    { highlight: false, label: 'Ask One Model', status: 'Current', tools: 'ChatGPT, Claude, or Gemini. One perspective, one answer.' },
    { highlight: true, label: 'Council Deliberation', status: 'The Upgrade', tools: 'Multiple models debate. Cross-examine. Synthesize.' },
    { highlight: false, label: 'Informed Decision', status: 'Outcome', tools: 'Consensus, dissent, trade-offs — all documented.' },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="The Gap"
          heading="One Model Gives You an Answer."
          headingHighlight="A Council Gives You the Debate."
          description="Asking ChatGPT is like consulting one expert. An LLM council assembles a panel of experts who challenge each other's reasoning — so the blind spots get caught before you commit."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          {stages.map(stage => (
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
          <p className="text-muted-foreground max-w-xl mx-auto">
            Every important decision has trade-offs. A council makes them visible.
            Architecture decisions, investment theses, research validation — any question
            that deserves more than one model&apos;s opinion.
          </p>
        </MotionDiv>
      </div>
    </section>
  );
}

function WhyDeliberationSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="Why Deliberation Beats"
          headingHighlight="Consensus"
          description="Side-by-side display shows answers. Deliberation forces engagement. That's the difference between a comparison tool and a council."
        />

        <MotionDiv
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={subtleFade.hidden}
          whileInView={subtleFade.visible}
          viewport={VIEWPORT_ONCE}
        >
          {DELIBERATION_ADVANTAGES.map((item, i) => (
            <MotionDiv
              key={item.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT_ONCE}
              transition={{ ...quickTransition, delay: i * 0.04 }}
            >
              <Card variant={CardVariants.GLASS} className="relative h-full">
                <GlowingEffect spread={30} glow proximity={48} disabled={false} />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <item.icon className={`size-6 ${item.color}`} />
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            </MotionDiv>
          ))}
        </MotionDiv>

        <MotionDiv
          className="mt-12 text-center"
          initial={subtleFade.hidden}
          whileInView={subtleFade.visible}
          viewport={VIEWPORT_ONCE}
          transition={quickTransition}
        >
          <p className="text-3xl sm:text-4xl font-semibold mb-4">
            <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
              +
              <NumberTicker
                value={28}
                className="text-3xl sm:text-4xl font-semibold bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent"
              />
            </span>
            {' percentage points'}
          </p>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Multi-model debate improves accuracy by +28 percentage points &mdash; ICML 2024
            Best Paper (Khan et al.)
          </p>
        </MotionDiv>
      </div>
    </section>
  );
}

function MarketValidationSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          label="Research Validation"
          heading="The Science Behind"
          headingHighlight="LLM Councils"
          description="The research is clear: AI models produce better answers when they argue. Three landmark studies establish why council-style deliberation outperforms single-model queries."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SHARED_RESEARCH_STATS.map((item, i) => {
            const isCenter = i === 1;
            const is28pp = item.stat === '+28pp';
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
                    : numericValue !== null
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
          <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
            &quot;Structured disagreement catches trade-offs, risks, and edge cases that no single
            model surfaces on its own.&quot;
          </blockquote>
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          heading="How DebateKit Compares to"
          headingHighlight="Other Council Tools"
        />

        <BlurFade delay={0.1} inView>
          <div className="hidden md:block overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 font-medium text-muted-foreground">Feature</th>
                  {COMPARISON_TOOLS.map(tool => (
                    <th
                      key={tool.name}
                      className={`p-4 font-semibold text-center ${
                        tool.highlight
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {tool.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((feature, featureIdx) => (
                  <tr
                    key={feature}
                    className={
                      featureIdx < COMPARISON_FEATURES.length - 1
                        ? 'border-b border-white/5'
                        : ''
                    }
                  >
                    <td className="p-4 text-muted-foreground">{feature}</td>
                    {COMPARISON_TOOLS.map(tool => (
                      <td
                        key={`${tool.name}-${feature}`}
                        className={`p-4 text-center ${
                          tool.highlight ? 'bg-primary/5' : ''
                        }`}
                      >
                        {tool.features[featureIdx]
                          ? (
                              <Icons.check className="size-5 text-emerald-400 mx-auto" />
                            )
                          : (
                              <Icons.x className="size-5 text-muted-foreground/30 mx-auto" />
                            )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BlurFade>

        <div className="md:hidden space-y-4">
          {COMPARISON_TOOLS.map(tool => (
            <Card
              key={tool.name}
              variant={tool.highlight ? CardVariants.GLASS_STRONG : CardVariants.GLASS_SUBTLE}
              className={tool.highlight ? 'relative ring-1 ring-primary/30' : ''}
            >
              {tool.highlight && (
                <GlowingEffect spread={40} glow proximity={64} disabled={false} />
              )}
              <CardContent className="pt-6">
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    tool.highlight ? 'text-primary' : ''
                  }`}
                >
                  {tool.name}
                </h3>
                <ul className="space-y-2">
                  {COMPARISON_FEATURES.map((feature, featureIdx) => (
                    <li key={feature} className="flex items-center gap-3">
                      {tool.features[featureIdx]
                        ? (
                            <Icons.check className="size-4 text-emerald-400 flex-shrink-0" />
                          )
                        : (
                            <Icons.x className="size-4 text-muted-foreground/30 flex-shrink-0" />
                          )}
                      <span
                        className={`text-sm ${
                          tool.features[featureIdx]
                            ? 'text-foreground'
                            : 'text-muted-foreground/50'
                        }`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
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
    description:
      'LLM council platform where multiple AI models deliberate, challenge, and synthesize answers. Built on Karpathy\'s council concept with sequential debate, structured modes, role-based personas, and moderator synthesis. Research-validated at ICML 2024. Built for architecture decisions, investment analysis, research validation, and any question that deserves more than one model\'s opinion.',
    name: 'DebateKit LLM Council',
    path: '/solutions/llm-council',
    price: 0,
  });

  const faqJsonLd = createFAQPageJsonLd(
    FAQ_ITEMS.map(f => ({ answer: f.answer, question: f.question })),
  );

  const breadcrumbJsonLd = createBreadcrumbListJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Solutions', path: '/solutions/llm-council' },
    { name: 'LLM Council', path: '/solutions/llm-council' },
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

export default function LlmCouncilScreen() {
  return (
    <LandingPageLayout>
      <JsonLdScripts />
      <HeroSection />
      <SectionDivider />
      <FeatureCardGridSection
        label="The Concept"
        heading="What Is an"
        headingHighlight="LLM Council?"
        description="An LLM council queries multiple AI models on the same question and compares or deliberates over their responses. The concept originated from Andrej Karpathy's idea: instead of trusting one model's answer, assemble a council of models that each bring different training, different strengths, and different blind spots."
        items={COUNCIL_PRINCIPLES}
      />
      <SectionDivider />
      <WorkflowGapSection />
      <SectionDivider />
      <PersonaGridSection
        heading="Built for Anyone Making"
        headingHighlight="High-Stakes Decisions"
        description="If your decision has genuine trade-offs, an LLM council surfaces the perspectives you'd miss with a single model. The more ambiguous the question, the more valuable the deliberation."
        personas={PERSONAS}
      />
      <SectionDivider />
      <FailureGridSection
        heading="Why One Model Isn't Enough for"
        headingHighlight="Important Decisions"
        description="A single LLM produces one confident answer from one perspective. For questions with genuine trade-offs, that's not analysis — it's a coin flip with better grammar."
        items={SINGLE_MODEL_FAILURES}
        footer={(
          <>
            An LLM council fixes this. When a Systems Architect and Security Reviewer debate the same
            design — and a Pragmatist grounds everything in operational reality — confirmation bias gets
            caught, blind spots get flagged, and the trade-offs become visible.
          </>
        )}
      />
      <SectionDivider />
      <WhyDeliberationSection />
      <SectionDivider />
      <RoleGridSection
        heading="Assign Roles."
        headingHighlight="Start the Deliberation."
        description="In DebateKit, you pick the AI models and assign each one a role \u2014 just like assembling a real advisory council. Here's a setup teams use for architecture decisions:"
        roles={ROLES}
        configDemo={<LlmCouncilConfigDemo />}
      />
      <SectionDivider />
      <ModesGridSection footer="You choose the mode. The models do the rest." />
      <SectionDivider />
      <ComparisonStepsSection
        heading="One Model's Opinion \u2192"
        headingHighlight="Council-Grade Deliberation"
        description="From guessing which model to trust to having all perspectives synthesized."
        manual={{
          badge: 'Single Model',
          label: 'One Perspective',
          steps: [
            'Open ChatGPT. Ask your question. Get one answer.',
            'Try a different model. Get a different answer.',
            'Compare manually. No cross-examination, no synthesis.',
            'Make a decision based on whichever answer sounded most convincing.',
          ],
        }}
        debatekit={{
          badge: 'LLM Council',
          label: 'Full Deliberation',
          steps: [
            'Assemble your council \u2014 pick models and assign roles',
            'Models deliberate sequentially, reading and challenging each other',
            'Council Moderator synthesizes consensus, dissent, and trade-offs',
            'You make the decision with the full debate in front of you',
          ],
        }}
      />
      <SectionDivider />
      <MarketValidationSection />
      <ResearchFoundationCallout />
      <SectionDivider />
      <ComparisonSection />
      <SectionDivider />
      <FAQSection items={FAQ_ITEMS} variant="card" />
      <SectionDivider />
      <SolutionLinksSection currentPath="/solutions/llm-council" />
      <SectionDivider />
      <BottomCTASection
        heading="Start Your First Council Debate"
        description="Assemble your AI council. Pick the models. Choose the mode. Whether it's architecture decisions, investment analysis, or any question that deserves more than one perspective \u2014 your council is ready."
        ctaText="Get Started Free"
      />
    </LandingPageLayout>
  );
}
