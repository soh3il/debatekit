import { Link } from '@tanstack/react-router';
import { BarChart3, CheckCircle, Heart, MessageSquare, MessagesSquare, Scale, TrendingUp } from 'lucide-react';

import { Icons } from '@/components/icons';
import { MCPTerminalDemo } from '@/components/landing/mcp-terminal-demo';
import { MotionDiv, MotionP, quickTransition, subtleFade, VIEWPORT_ONCE } from '@/components/landing/sections/motion-variants';
import { NumberedList } from '@/components/landing/sections/numbered-list';
import { SectionHeader } from '@/components/landing/sections/section-header';
import { StatGrid } from '@/components/landing/sections/stat-grid';
import { BlurFade } from '@/components/ui/blur-fade';
import { BorderBeam } from '@/components/ui/border-beam';
import { Button } from '@/components/ui/button';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { StaggerContainer, StaggerItem } from '@/components/ui/motion';
import { TextAnimate } from '@/components/ui/text-animate';
import { useTranslations } from '@/lib/i18n';

import { PitchDemo } from './pitch-demo';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COUNCIL = [
  { angle: 270, provider: 'claude', roleKey: 'roleArchitect' },
  { angle: 0, provider: 'openai', roleKey: 'roleAnalyst' },
  { angle: 90, provider: 'google', roleKey: 'roleChallenger' },
  { angle: 180, provider: 'grok', roleKey: 'rolePragmatist' },
] as const;

const PLATFORMS: { icon: keyof typeof Icons; key: string }[] = [
  { icon: 'globe', key: 'webApp' },
  { icon: 'mcp', key: 'claudeCode' },
  { icon: 'cursor', key: 'cursor' },
  { icon: 'vscode', key: 'vscode' },
  { icon: 'openai', key: 'chatgpt' },
  { icon: 'slack', key: 'slack' },
  { icon: 'telegram', key: 'telegram' },
  { icon: 'code', key: 'api' },
  { icon: 'zapier', key: 'zapier' },
  { icon: 'n8n', key: 'n8n' },
  { icon: 'smithery', key: 'smithery' },
  { icon: 'plus', key: 'more' },
];

const PITCH_MCP_SCENARIO = {
  agentContinue: 'Council confirmed the approach. Structuring as a modular monolith with domain-bounded modules. Spinning up the async worker module separately. Proceeding with scaffolding.',
  agentWorking: 'The team is 4 engineers — I\'ll go with a modular monolith. Faster to ship, easier to reason about at this scale. Setting up the module boundaries now.',
  contextBriefing: 'Architecture decision: modular monolith vs microservices for a team of 4. Optimizing for velocity and maintainability.',
  models: [
    { color: 'text-emerald-400', label: 'GPT-4.1 (Architect)', text: 'Modular monolith is correct for a team of 4. But define module boundaries by domain context, not by feature. You\'ll thank yourself when you need to extract a service later.' },
    { color: 'text-blue-400', label: 'Gemini 2.5 Pro (Scaling)', text: 'Agree on monolith. Microservices at this team size add deployment overhead that eats velocity. One caveat: isolate the data layer per module now — it\'s the hardest thing to untangle later.' },
    { color: 'text-violet-400', label: 'Claude Opus (Pragmatist)', text: 'Monolith, but with one exception: if you have a clearly async workload (email, notifications), split that into a worker from day one. Everything else stays in the monolith.' },
  ],
  userInvoke: 'wait — let the council weigh in on this',
  verdict: 'Modular monolith. 3/3 converged. Domain-bounded modules, isolated data layers, and a single async worker for background jobs. Defer microservices until the team outgrows the monolith.',
};

const MCP_MODES = [
  { descKey: 'mode1Desc', titleKey: 'mode1Title' },
  { descKey: 'mode2Desc', titleKey: 'mode2Title' },
  { descKey: 'mode3Desc', titleKey: 'mode3Title' },
] as const;

const USE_CASE_ICONS = [BarChart3, Scale, Heart, TrendingUp] as const;

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function SectionHook() {
  const t = useTranslations('pitch.hook');

  return (
    <section className="space-y-6">
      <TextAnimate
        as="h1"
        animation="blurInUp"
        by="word"
        className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
      >
        {t('headline')}
      </TextAnimate>

      <BlurFade delay={0.1}>
        <p className="text-lg leading-relaxed text-muted-foreground">{t('p1')}</p>
      </BlurFade>
      <BlurFade delay={0.2}>
        <p className="text-lg leading-relaxed text-muted-foreground">{t('p2')}</p>
      </BlurFade>

      {/* Council formation visual */}
      <BlurFade delay={0.3}>
        <div className="relative mx-auto mt-8 size-64 sm:size-72">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative flex size-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
              <Icons.sparkles className="size-6 text-primary" />
              <div className="absolute inset-0 animate-pulse rounded-full bg-primary/5" />
            </div>
          </div>

          <StaggerContainer className="contents">
            {COUNCIL.map(({ angle, provider, roleKey }) => {
              const radius = 100;
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;

              return (
                <StaggerItem
                  key={provider}
                  className="absolute left-1/2 top-1/2 flex flex-col items-center gap-1.5"
                  style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-card ring-1 ring-border shadow-lg">
                    <img
                      src={`/static/icons/ai-models/${provider}.png`}
                      alt={provider}
                      className="size-7 object-contain"
                    />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">{t(roleKey)}</span>
                </StaggerItem>
              );
            })}
          </StaggerContainer>

          <svg className="absolute inset-0 size-full opacity-20" viewBox="0 0 288 288">
            <circle cx="144" cy="144" r="100" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" className="text-primary" />
          </svg>
        </div>
      </BlurFade>
    </section>
  );
}

function SectionProblem() {
  const t = useTranslations('pitch.problem');

  return (
    <section>
      <SectionHeader
        label={t('label')}
        heading={t('headline')}
        headingHighlight={t('headlineHighlight')}
        description={[t('p1'), t('p2'), t('p3')]}
      />
    </section>
  );
}

function SectionInsight() {
  const t = useTranslations('pitch.insight');

  return (
    <section>
      <SectionHeader
        label={t('label')}
        heading={t('headline')}
        headingHighlight={t('headlineHighlight')}
        description={[t('p1'), t('p2'), t('p3')]}
      />
      <NumberedList
        accentColor="emerald"
        items={[
          {
            description: t('step1Desc'),
            icon: MessageSquare,
            number: '01',
            title: t('step1'),
          },
          {
            description: t('step2Desc'),
            icon: MessagesSquare,
            number: '02',
            title: t('step2'),
          },
          {
            description: t('step3Desc'),
            icon: CheckCircle,
            number: '03',
            title: t('step3'),
          },
        ]}
      />
    </section>
  );
}

function SectionDemo() {
  const t = useTranslations('pitch.demo');

  return (
    <section>
      <SectionHeader
        label={t('label')}
        heading={t('headline')}
        headingHighlight={t('headlineHighlight')}
        description={t('p1')}
      />
      <PitchDemo />
    </section>
  );
}

function SectionEvidence() {
  const t = useTranslations('pitch.evidence');

  return (
    <section>
      <SectionHeader
        label={t('label')}
        heading={t('headline')}
        headingHighlight={t('headlineHighlight')}
        description={[t('p1'), t('p2'), t('p3')]}
      />
      <StatGrid
        accentColor="emerald"
        items={[
          { label: t('stat1Label'), source: t('stat1Source'), value: '+28%' },
          { label: t('stat2Label'), source: t('stat2Source'), value: '+15%' },
          { label: t('stat3Label'), source: t('stat3Source'), value: '4' },
        ]}
      />
    </section>
  );
}

function SectionWorthIt() {
  const t = useTranslations('pitch.worthIt');

  const cards = [
    { descKey: 'card1Desc', titleKey: 'card1Title', valueKey: 'card1Value' },
    { descKey: 'card2Desc', titleKey: 'card2Title', valueKey: 'card2Value' },
    { descKey: 'card3Desc', titleKey: 'card3Title', valueKey: 'card3Value' },
  ] as const;

  return (
    <section>
      <SectionHeader
        label={t('label')}
        heading={t('headline')}
        headingHighlight={t('headlineHighlight')}
        description={t('p1')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12">
        {cards.map((card, i) => (
          <MotionDiv
            key={card.titleKey}
            initial={subtleFade.hidden}
            transition={{ ...quickTransition, delay: i * 0.1 }}
            viewport={VIEWPORT_ONCE}
            whileInView={subtleFade.visible}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">
              {t(card.titleKey)}
            </p>
            <p className="text-2xl font-semibold bg-gradient-to-b from-emerald-400 to-emerald-600/60 bg-clip-text text-transparent mb-2 leading-tight">
              {t(card.valueKey)}
            </p>
            <p className="text-sm text-muted-foreground/70 leading-relaxed">
              {t(card.descKey)}
            </p>
          </MotionDiv>
        ))}
      </div>

      <MotionP
        className="mt-8 text-sm text-muted-foreground/70 italic max-w-2xl"
        initial={subtleFade.hidden}
        transition={{ ...quickTransition, delay: 0.3 }}
        viewport={VIEWPORT_ONCE}
        whileInView={subtleFade.visible}
      >
        {t('footer')}
      </MotionP>
    </section>
  );
}

function SectionMCP() {
  const t = useTranslations('pitch.mcp');

  return (
    <section>
      <SectionHeader
        label={t('label')}
        heading={t('headline')}
        headingHighlight={t('headlineHighlight')}
        description={t('p1')}
      />

      <BlurFade inView delay={0.1}>
        <MCPTerminalDemo scenario={PITCH_MCP_SCENARIO} />
      </BlurFade>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10">
        {MCP_MODES.map((mode, i) => (
          <MotionDiv
            key={mode.titleKey}
            className="rounded-xl border border-border/50 bg-card/30 p-5 backdrop-blur-sm"
            initial={subtleFade.hidden}
            transition={{ ...quickTransition, delay: i * 0.1 }}
            viewport={VIEWPORT_ONCE}
            whileInView={subtleFade.visible}
          >
            <h3 className="text-sm font-semibold mb-1">{t(mode.titleKey)}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{t(mode.descKey)}</p>
          </MotionDiv>
        ))}
      </div>

      <BlurFade inView delay={0.2}>
        <div className="mt-8">
          <Button variant="outline" size="lg" className="rounded-full" asChild>
            <Link to="/chat/connect">{t('cta')}</Link>
          </Button>
        </div>
      </BlurFade>
    </section>
  );
}

function SectionPlatforms() {
  const t = useTranslations('pitch.platforms');

  return (
    <section>
      <SectionHeader
        label={t('label')}
        heading={t('headline')}
        headingHighlight={t('headlineHighlight')}
        description={t('p1')}
      />

      <StaggerContainer className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4">
        {PLATFORMS.map(({ icon, key }) => {
          const IconComp = Icons[icon];
          return (
            <StaggerItem key={key}>
              <div className="group flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-4 py-4 transition-colors hover:border-primary/30 hover:bg-primary/5">
                <IconComp className="size-6 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="text-xs font-medium text-muted-foreground">{t(key)}</span>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </section>
  );
}

function SectionUseCases() {
  const t = useTranslations('pitch.useCases');

  const cases = [
    { descKey: 'case1Desc', href: '/solutions/investment-analysis', titleKey: 'case1Title' },
    { descKey: 'case2Desc', href: '/solutions/legal-review', titleKey: 'case2Title' },
    { descKey: 'case3Desc', href: '/solutions/healthcare-clinical', titleKey: 'case3Title' },
    { descKey: 'case4Desc', href: '/solutions/ma-deal-screening', titleKey: 'case4Title' },
  ] as const;

  return (
    <section>
      <SectionHeader
        label={t('label')}
        heading={t('headline')}
        headingHighlight={t('headlineHighlight')}
        description={t('p1')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {cases.map((c, i) => {
          const IconComp = USE_CASE_ICONS[i] ?? BarChart3;
          return (
            <Link key={c.titleKey} to={c.href}>
              <MotionDiv
                className="flex items-start gap-4 rounded-xl border border-border/50 bg-card/30 p-5 backdrop-blur-sm transition-colors hover:border-emerald-500/40 hover:bg-card/50"
                initial={subtleFade.hidden}
                transition={{ ...quickTransition, delay: i * 0.1 }}
                viewport={VIEWPORT_ONCE}
                whileInView={subtleFade.visible}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <IconComp className="size-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{t(c.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(c.descKey)}</p>
                </div>
              </MotionDiv>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SectionCTA() {
  const t = useTranslations('pitch.cta');

  return (
    <section>
      <SectionHeader
        label={t('label')}
        heading={t('headline')}
        headingHighlight={t('headlineHighlight')}
        description={t('subtext')}
      />

      <BlurFade inView delay={0.1}>
        <div className="relative mt-2 inline-flex flex-col items-center gap-4 rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur-sm sm:flex-row">
          <HoverBorderGradient as={Link} to="/chat" containerClassName="rounded-full" className="px-6 py-2.5 text-sm font-medium">
            {t('ctaPrimary')}
          </HoverBorderGradient>
          <Button variant="outline" size="lg" className="rounded-full" asChild>
            <Link to="/chat/connect" preload="intent">
              {t('ctaSecondary')}
            </Link>
          </Button>
          <BorderBeam size={80} duration={8} colorFrom="hsl(var(--primary))" colorTo="hsl(var(--primary) / 0.3)" />
        </div>
      </BlurFade>

      <BlurFade inView delay={0.2}>
        <p className="mt-4 text-xs text-muted-foreground/50">{t('footer')}</p>
      </BlurFade>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main page — 10 sections
// ---------------------------------------------------------------------------

export function PitchPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-16 px-4 py-8 sm:px-6 sm:py-12 md:space-y-20">
      <SectionHook />
      <SectionProblem />
      <SectionInsight />
      <SectionDemo />
      <SectionEvidence />
      <SectionWorthIt />
      <SectionMCP />
      <SectionPlatforms />
      <SectionUseCases />
      <SectionCTA />
    </div>
  );
}
