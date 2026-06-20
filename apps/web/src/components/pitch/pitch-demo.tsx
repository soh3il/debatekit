'use client';

/* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- Animation demo requires setState in intervals/timeouts */
import { MessageRoles, ModelIds, MODERATOR_NAME } from '@debatekit/shared';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SimpleMarkdown } from '@/components/auth/demo-markdown-components';
import { ParticipantHeader } from '@/components/chat/participant-header';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BRAND } from '@/constants';
import { TYPING_CHARS_PER_FRAME, TYPING_FRAME_INTERVAL } from '@/lib/ui/animations';
import { cn } from '@/lib/ui/cn';
import { getAvatarPropsFromModelId } from '@/lib/utils/ai-display';

// ============================================================================
// DATA
// ============================================================================

const PROMPT_TEXT = 'Should we acquire this competitor?';

const DEMO_USER_MESSAGE
  = 'Our closest competitor is doing $5M ARR with a product that fills our biggest feature gap. They\'re open to a deal at 3x revenue, but their engineering culture is very different from ours and half their team is remote.';

const DEMO_PARTICIPANT_CONFIG = [
  { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, role: 'M&A Strategist' },
  { modelId: ModelIds.OPENAI_GPT_4_1, role: 'Devil\'s Advocate' },
  { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, role: 'Integration Lead' },
  { modelId: ModelIds.X_AI_GROK_4, role: 'Market Analyst' },
] as const;

const COMPOSER_MODELS = [
  ModelIds.ANTHROPIC_CLAUDE_SONNET_4,
  ModelIds.OPENAI_GPT_4_1,
  ModelIds.GOOGLE_GEMINI_2_5_PRO,
  ModelIds.X_AI_GROK_4,
] as const;

const DEMO_RESPONSES = [
  `$15M for a product that fills your biggest gap is cheap compared to building it — that's 18+ months of R&D you skip. **At 3x revenue, you're paying a fair multiple, not a premium.** Lock in the deal before they hit $8M ARR and the price doubles.`,
  `Cheap acquisitions are cheap for a reason. **"Different engineering culture" is CEO-speak for "this integration will be hell."** Half their team is remote, yours isn't — you'll lose 30-40% of their engineers within a year. You're not buying a product, you're buying a rewrite.`,
  `Culture clash is real but manageable — **if you keep them as a separate unit for the first 12 months.** Don't merge codebases on day one. Run parallel systems, integrate at the API layer, and let their remote culture stay intact. The product gap closes immediately; the org merge can be gradual.`,
  `Timing matters more than price here. **Two other players are circling this space — if you pass, one of them acquires this team by Q3.** The competitive landscape shifts from "we have a feature gap" to "we're fighting a better-funded rival with our missing feature." Move now or plan to build for 2 years.`,
];

const DEMO_MODERATOR = `**Recommendation: Acquire, but renegotiate terms.** The strategic value is clear — the feature gap is real and competitors are circling. **However:** push for 2.5x revenue (not 3x) given integration risk, and structure 20% as earnout tied to retention. Keep teams separate for 12 months. The biggest risk isn't the price — it's botching the integration. **Next steps:** engage outside counsel for LOI, run 30-day technical due diligence, and get a culture audit before signing.`;

// ============================================================================
// MESSAGE COMPONENTS
// ============================================================================

const UserMessage = memo(({ text }: { text: string }) => (
  <div className="flex flex-col items-end gap-2">
    <div
      dir="auto"
      className={cn(
        'max-w-[85%] ml-auto w-fit',
        'bg-secondary text-secondary-foreground',
        'rounded-2xl rounded-br-md px-4 py-3',
        'text-base leading-relaxed',
      )}
    >
      <SimpleMarkdown>{text}</SimpleMarkdown>
    </div>
  </div>
));

const ParticipantMessage = memo(({
  isStreaming,
  modelId,
  role,
  text,
}: {
  modelId: string;
  role: string;
  text: string;
  isStreaming: boolean;
}) => {
  const avatarProps = useMemo(
    () => getAvatarPropsFromModelId(MessageRoles.ASSISTANT, modelId),
    [modelId],
  );

  return (
    <div className="flex justify-start">
      <div className="w-full">
        <ParticipantHeader
          avatarSrc={avatarProps.src}
          avatarName={avatarProps.name}
          displayName={avatarProps.name}
          role={role}
          isStreaming={isStreaming}
        />
        {text && (
          <SimpleMarkdown className="text-foreground">{text}</SimpleMarkdown>
        )}
      </div>
    </div>
  );
});

const ModeratorMessage = memo(({
  isStreaming,
  text,
}: {
  text: string;
  isStreaming: boolean;
}) => (
  <div className="flex justify-start">
    <div className="w-full">
      <ParticipantHeader
        avatarSrc={BRAND.logos.main}
        avatarName={MODERATOR_NAME}
        displayName={MODERATOR_NAME}
        isStreaming={isStreaming}
      />
      {text && (
        <SimpleMarkdown className="text-foreground">{text}</SimpleMarkdown>
      )}
    </div>
  </div>
));

// ============================================================================
// COMPOSER SUB-COMPONENTS
// ============================================================================

function ModelAvatarStack({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
          className="flex -space-x-2"
        >
          {COMPOSER_MODELS.map(modelId => (
            <ComposerAvatar key={modelId} modelId={modelId} />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ComposerAvatar({ modelId }: { modelId: string }) {
  const props = useMemo(
    () => getAvatarPropsFromModelId(MessageRoles.ASSISTANT, modelId),
    [modelId],
  );

  return (
    <Avatar className="size-7 border-2 border-background">
      <AvatarImage src={props.src} alt={props.name} className="object-contain p-0.5" />
      <AvatarFallback className="text-[7px] bg-muted">
        {props.name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type Phase = 'idle' | 'typing' | 'sending' | 'analyzing' | 'streaming' | 'complete';

const TOTAL_STEPS = DEMO_PARTICIPANT_CONFIG.length + 1; // 4 participants + moderator

export function PitchDemo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [composerText, setComposerText] = useState('');
  const [showUserMessage, setShowUserMessage] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [texts, setTexts] = useState(() => Array.from<string>({ length: TOTAL_STEPS }).fill(''));
  const [showAvatars, setShowAvatars] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  // SSR guard
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // IntersectionObserver — auto-play when visible
  useEffect(() => {
    if (!isMounted || hasStartedRef.current) {
      return;
    }
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !hasStartedRef.current) {
          hasStartedRef.current = true;
          setPhase('typing');
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isMounted]);

  // Auto-scroll when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [texts, showUserMessage, activeIdx]);

  // Phase 1: Typing animation in composer
  useEffect(() => {
    if (!isMounted || phase !== 'typing') {
      return;
    }
    let charIdx = 0;
    setComposerText('');

    intervalRef.current = setInterval(() => {
      charIdx += TYPING_CHARS_PER_FRAME;
      if (charIdx >= PROMPT_TEXT.length) {
        setComposerText(PROMPT_TEXT);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        intervalRef.current = null;
        timeoutRef.current = setTimeout(setPhase, 500, 'sending');
      } else {
        setComposerText(PROMPT_TEXT.slice(0, charIdx));
      }
    }, TYPING_FRAME_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isMounted, phase]);

  // Phase 2: Sending
  useEffect(() => {
    if (!isMounted || phase !== 'sending') {
      return;
    }
    setShowUserMessage(true);
    const t = setTimeout(setPhase, 500, 'analyzing');
    return () => clearTimeout(t);
  }, [isMounted, phase]);

  // Phase 3: Analyzing
  useEffect(() => {
    if (!isMounted || phase !== 'analyzing') {
      return;
    }
    setShowAvatars(true);
    const t = setTimeout(() => {
      setPhase('streaming');
      setActiveIdx(0);
    }, 1000);
    return () => clearTimeout(t);
  }, [isMounted, phase]);

  // Streaming engine
  const runAnimation = useCallback((idx: number) => {
    const fullText = idx === DEMO_PARTICIPANT_CONFIG.length
      ? DEMO_MODERATOR
      : (DEMO_RESPONSES[idx] ?? '');
    let charIdx = 0;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      charIdx += TYPING_CHARS_PER_FRAME;
      const newText = fullText.slice(0, Math.min(charIdx, fullText.length));

      setTexts((prev) => {
        const next = [...prev];
        next[idx] = newText;
        return next;
      });

      if (charIdx >= fullText.length) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        intervalRef.current = null;
        setTimeout(() => {
          if (idx < DEMO_PARTICIPANT_CONFIG.length) {
            setActiveIdx(idx + 1);
          } else {
            setPhase('complete');
          }
        }, 400);
      }
    }, TYPING_FRAME_INTERVAL);
  }, []);

  useEffect(() => {
    if (!isMounted || phase !== 'streaming' || activeIdx < 0 || activeIdx > DEMO_PARTICIPANT_CONFIG.length) {
      return;
    }
    runAnimation(activeIdx);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isMounted, phase, activeIdx, runAnimation]);

  const isAnalyzing = phase === 'analyzing';
  const isStreamingOrComplete = phase === 'streaming' || phase === 'complete';

  return (
    <div ref={containerRef} className="flex flex-col h-[500px] sm:h-[600px] rounded-2xl border border-border/50 bg-background overflow-hidden text-left">
      {/* Chat area */}
      <ScrollArea className="flex-1" viewportRef={scrollRef}>
        <div className="w-full px-4 sm:px-6 py-6 space-y-14">
          {showUserMessage && <UserMessage text={DEMO_USER_MESSAGE} />}

          {DEMO_PARTICIPANT_CONFIG.map((p, idx) => {
            if (activeIdx < idx) {
              return null;
            }
            const isActive = activeIdx === idx;
            const text = isActive
              ? texts[idx]
              : (activeIdx > idx ? DEMO_RESPONSES[idx] : '');

            return (
              <ParticipantMessage
                key={p.modelId}
                modelId={p.modelId}
                role={p.role}
                text={text ?? ''}
                isStreaming={isActive}
              />
            );
          })}

          {activeIdx >= DEMO_PARTICIPANT_CONFIG.length && (
            <ModeratorMessage
              text={texts[DEMO_PARTICIPANT_CONFIG.length] ?? ''}
              isStreaming={activeIdx === DEMO_PARTICIPANT_CONFIG.length}
            />
          )}
        </div>
      </ScrollArea>

      {/* Gradient fade */}
      <div className="h-4 bg-gradient-to-t from-background to-transparent -mt-4 relative z-10" />

      {/* Composer section */}
      <div className="border-t border-border/40 bg-background p-4 sm:p-6">
        {/* Auto badge */}
        <div className="flex items-center gap-1 mb-4">
          <div className="inline-flex items-center px-1 py-1">
            <motion.button
              type="button"
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-foreground"
            >
              <motion.div
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-fuchsia-500/20 border border-purple-500/30"
              />
              <motion.div
                className="relative z-10 flex items-center gap-1.5"
                animate={{ color: 'rgb(168, 85, 247)' }}
              >
                <motion.div
                  animate={{
                    rotate: isAnalyzing ? 360 : 0,
                    scale: isAnalyzing ? [1, 1.1, 1] : 1,
                  }}
                  transition={{
                    rotate: { duration: 1, ease: 'linear', repeat: isAnalyzing ? Infinity : 0 },
                    scale: { duration: 0.4, ease: 'easeOut' },
                  }}
                >
                  <Icons.sparkles className="size-3.5 text-purple-400" />
                </motion.div>
                <span>{isAnalyzing ? 'Analyzing...' : 'Auto'}</span>
              </motion.div>
            </motion.button>
          </div>
        </div>

        {/* Input area */}
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
          <div className={cn(
            'text-sm min-h-[2.5rem] mb-4',
            phase === 'typing' ? 'text-foreground/80' : 'text-muted-foreground/50',
          )}
          >
            {composerText}
            {phase === 'typing' && (
              <motion.span
                className="inline-block w-0.5 h-4 bg-foreground/60 align-text-bottom ml-0.5"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
              />
            )}
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ModelAvatarStack visible={showAvatars || isStreamingOrComplete} />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg" aria-label="Attach">
                <Icons.paperclip className="size-4" />
              </button>
              <button
                type="button"
                className={cn(
                  'size-9 rounded-xl flex items-center justify-center',
                  phase === 'typing' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
                aria-label="Send"
              >
                <Icons.arrowUp className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
