'use client';

/* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- Animation demo requires setState in intervals/timeouts */
import { MessageRoles, MODERATOR_NAME } from '@debatekit/shared';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ParticipantHeader } from '@/components/chat/participant-header';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BRAND } from '@/constants';
import { TYPING_CHARS_PER_FRAME, TYPING_FRAME_INTERVAL } from '@/lib/ui/animations';
import { cn } from '@/lib/ui/cn';
import { getAvatarPropsFromModelId } from '@/lib/utils/ai-display';

import { SimpleMarkdown } from '../auth/demo-markdown-components';

// ============================================================================
// TYPES
// ============================================================================

type Phase = 'typing' | 'sending' | 'analyzing' | 'streaming' | 'complete';

type ParticipantConfig = {
  modelId: string;
  role: string;
};

export type HeroDemoData = {
  /** Models shown in the composer avatar stack */
  composerModels: readonly string[];
  /** The moderator synthesis text */
  moderator: string;
  /** Participant model + role configuration */
  participants: readonly ParticipantConfig[];
  /** Short text typed into the composer */
  promptText: string;
  /** Full response texts, one per participant */
  responses: readonly string[];
  /** Full user message shown after sending */
  userMessage: string;
};

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

function ModelAvatarStack({ models, visible }: { models: readonly string[]; visible: boolean }) {
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
          {models.map(modelId => (
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

export function HeroDemoBase({ data }: { data: HeroDemoData }) {
  const totalSteps = data.participants.length + 1; // participants + moderator
  const [phase, setPhase] = useState<Phase>('typing');
  const [composerText, setComposerText] = useState('');
  const [showUserMessage, setShowUserMessage] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [texts, setTexts] = useState(() => Array.from<string>({ length: totalSteps }).fill(''));
  const [showAvatars, setShowAvatars] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // SSR guard
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
      if (charIdx >= data.promptText.length) {
        setComposerText(data.promptText);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        intervalRef.current = null;
        // Wait a beat, then send
        timeoutRef.current = setTimeout(() => setPhase('sending'), 500);
      } else {
        setComposerText(data.promptText.slice(0, charIdx));
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
  }, [isMounted, phase, data.promptText]);

  // Phase 2: Sending - show user message, keep prompt visible but disabled
  useEffect(() => {
    if (!isMounted || phase !== 'sending') {
      return;
    }
    setShowUserMessage(true);
    const t = setTimeout(() => setPhase('analyzing'), 500);
    return () => clearTimeout(t);
  }, [isMounted, phase]);

  // Phase 3: Analyzing - show avatars, then start streaming
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
    const fullText = idx === data.participants.length
      ? data.moderator
      : (data.responses[idx] ?? '');
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
          if (idx < data.participants.length) {
            setActiveIdx(idx + 1);
          } else {
            setPhase('complete');
          }
        }, 400);
      }
    }, TYPING_FRAME_INTERVAL);
  }, [data.participants.length, data.moderator, data.responses]);

  useEffect(() => {
    if (!isMounted || phase !== 'streaming' || activeIdx < 0 || activeIdx > data.participants.length) {
      return;
    }
    runAnimation(activeIdx);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isMounted, phase, activeIdx, runAnimation, data.participants.length]);

  const isAnalyzing = phase === 'analyzing';
  const isStreamingOrComplete = phase === 'streaming' || phase === 'complete';

  return (
    <div className="flex flex-col h-[600px] sm:h-[700px] bg-background overflow-hidden text-left">
      {/* Chat area */}
      <ScrollArea className="flex-1" viewportRef={scrollRef}>
        <div className="w-full px-4 sm:px-6 py-6 space-y-14">
          {showUserMessage && <UserMessage text={data.userMessage} />}

          {data.participants.map((p, idx) => {
            if (activeIdx < idx) {
              return null;
            }
            const isActive = activeIdx === idx;
            const text = isActive
              ? texts[idx]
              : (activeIdx > idx ? data.responses[idx] : '');

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

          {activeIdx >= data.participants.length && (
            <ModeratorMessage
              text={texts[data.participants.length] ?? ''}
              isStreaming={activeIdx === data.participants.length}
            />
          )}
        </div>
      </ScrollArea>

      {/* Gradient fade between chat and composer */}
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
              <ModelAvatarStack models={data.composerModels} visible={showAvatars || isStreamingOrComplete} />
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
