'use client';

/* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- Animation demo requires setState in intervals/timeouts */
import { motion } from 'motion/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { ACCENT_COLORS } from '@/components/landing/sections/accent-colors';
import { TYPING_CHARS_PER_FRAME, TYPING_FRAME_INTERVAL } from '@/lib/ui/animations';
import { cn } from '@/lib/ui/cn';

// ============================================================================
// TYPES
// ============================================================================

const PHASE_VALUES = ['agent-working', 'user-invoke', 'council-spinning', 'context-briefing', 'streaming-responses', 'streaming-verdict', 'agent-continue', 'complete'] as const;
type Phase = (typeof PHASE_VALUES)[number];

export const DemoScenarioSchema = z.object({
  agentContinue: z.string(),
  agentWorking: z.string(),
  contextBriefing: z.string(),
  models: z.array(z.object({ color: z.string(), label: z.string(), text: z.string() })),
  userInvoke: z.string(),
  verdict: z.string(),
});
export type DemoScenario = z.infer<typeof DemoScenarioSchema>;

// ============================================================================
// BRAND COLORS
// ============================================================================

const MODEL_BRAND_COLORS = {
  Claude: 'text-[#E8845A]',
  DeepSeek: 'text-[#4D6BFE]',
  Gemini: 'text-[#669DF7]',
  GPT: 'text-[#74AA9C]',
  Grok: 'text-[#F5F5F5]',
} as const;

type ModelBrandKey = keyof typeof MODEL_BRAND_COLORS;

function getModelBrandColor(label: string): string {
  for (const key of Object.keys(MODEL_BRAND_COLORS) as ModelBrandKey[]) {
    if (label.includes(key)) {
      return MODEL_BRAND_COLORS[key];
    }
  }
  return 'text-gray-300';
}

// ============================================================================
// DATA
// ============================================================================

const AGENT_WORKING_TEXT
  = 'I\'ll denormalize user_name into the notifications table \u2014 faster reads, simpler queries. Writing the migration now.';

const USER_INVOKE_TEXT = 'hold on, let\'s debate this first';

const CONTEXT_BRIEFING_TEXT
  = 'Notifications schema design. Considering denormalizing user_name into each row vs normalized JOIN. Concern: name changes require row backfills.';

const MODEL_RESPONSES: { color: string; label: string; text: string }[] = [
  {
    color: ACCENT_COLORS.emerald.badgeText,
    label: 'GPT-4.1 (Architect)',
    text: 'Normalize. Denormalization trades write complexity for read speed \u2014 but your concern about backfills is the real risk. A foreign key JOIN is the safer default.',
  },
  {
    color: ACCENT_COLORS.blue.badgeText,
    label: 'Gemini 2.5 Pro (Performance)',
    text: 'Agree. An indexed FK lookup adds negligible latency. The backfill cost on name changes scales linearly with notification volume \u2014 not worth it.',
  },
  {
    color: ACCENT_COLORS.violet.badgeText,
    label: 'Grok (Data Engineer)',
    text: 'Normalize now. If read latency becomes a real problem later, a materialized view gives you both consistency and speed without changing your schema.',
  },
];

const VERDICT_TEXT
  = 'Normalize. 3/3 converged \u2014 the backfill risk on name changes outweighs any read speedup from denormalization. Use a foreign key with an index.';

const AGENT_CONTINUE_TEXT
  = 'Clear consensus. Normalizing with an indexed foreign key. The backfill risk alone settles it. Updating the migration now.';

// ============================================================================
// PHASE TIMING
// ============================================================================

const PHASE_DELAYS = {
  'agent-continue': 600,
  'context-briefing': 600,
  'council-spinning': 1200,
  'start-responses': 600,
  'user-invoke': 800,
  'verdict': 600,
} as const;

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const BlinkingCursor = memo(() => {
  return (
    <motion.span
      className="inline-block w-[7px] h-4 bg-green-400 align-text-bottom ml-0.5"
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
    />
  );
});

/** Claude Code session banner — mascot + version/model/path, matching the real CLI. */
const SessionBanner = memo(() => (
  <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4 pb-2.5 sm:pb-3 border-b border-white/[0.06]">
    <pre className="text-[#D97757] text-[10px] sm:text-xs !leading-none select-none shrink-0" aria-hidden>
      {' ▐▛███▜▌\n▝▜█████▛▘\n  ▘▘ ▝▝'}
    </pre>
    <div className="leading-snug text-[10px] sm:text-xs pt-0.5">
      <div>
        <span className="text-gray-200 font-bold">Claude Code</span>
        <span className="text-gray-500"> v2.1.56</span>
      </div>
      <div className="text-gray-500 mt-0.5">Opus 4.6 · Claude Max</div>
    </div>
  </div>
));

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type MCPTerminalDemoProps = {
  /** When true, renders without outer border and title bar — parent grid provides the frame */
  chromeless?: boolean;
  /** When provided, overrides the hardcoded engineering scenario data */
  scenario?: DemoScenario;
};

export const MCPTerminalDemo = memo(({ chromeless = false, scenario }: MCPTerminalDemoProps) => {
  // Resolve data sources — scenario prop overrides hardcoded defaults
  const resolvedWorking = scenario?.agentWorking ?? AGENT_WORKING_TEXT;
  const resolvedUserInvoke = scenario?.userInvoke ?? USER_INVOKE_TEXT;
  const resolvedContext = scenario?.contextBriefing ?? CONTEXT_BRIEFING_TEXT;
  const resolvedModels = scenario?.models ?? MODEL_RESPONSES;
  const resolvedVerdict = scenario?.verdict ?? VERDICT_TEXT;
  const resolvedContinue = scenario?.agentContinue ?? AGENT_CONTINUE_TEXT;

  const [phase, setPhase] = useState<Phase>('agent-working');
  const [agentWorkingText, setAgentWorkingText] = useState('');
  const [activeModelIdx, setActiveModelIdx] = useState(-1);
  const [modelTexts, setModelTexts] = useState<string[]>(() => Array.from<string>({ length: resolvedModels.length }).fill(''));
  const [verdictText, setVerdictText] = useState('');
  const [contextBriefingText, setContextBriefingText] = useState('');
  const [agentContinueText, setAgentContinueText] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // SSR guard
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentWorkingText, contextBriefingText, modelTexts, verdictText, agentContinueText, phase]);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Reset animation when scenario changes
  useEffect(() => {
    clearTimers();
    setPhase('agent-working');
    setAgentWorkingText('');
    setActiveModelIdx(-1);
    setModelTexts(Array.from<string>({ length: resolvedModels.length }).fill(''));
    setVerdictText('');
    setContextBriefingText('');
    setAgentContinueText('');
  }, [resolvedWorking, resolvedModels, clearTimers]);

  // Phase 1: Agent working — type the initial reasoning
  useEffect(() => {
    if (!isMounted || phase !== 'agent-working') {
      return;
    }
    let charIdx = 0;

    intervalRef.current = setInterval(() => {
      charIdx += TYPING_CHARS_PER_FRAME;
      if (charIdx >= resolvedWorking.length) {
        setAgentWorkingText(resolvedWorking);
        clearTimers();
        timeoutRef.current = setTimeout(setPhase, PHASE_DELAYS['user-invoke'], 'user-invoke');
      } else {
        setAgentWorkingText(resolvedWorking.slice(0, charIdx));
      }
    }, TYPING_FRAME_INTERVAL);

    return clearTimers;
  }, [isMounted, phase, clearTimers, resolvedWorking]);

  // Phase 2: User invokes council — instant
  useEffect(() => {
    if (!isMounted || phase !== 'user-invoke') {
      return;
    }
    timeoutRef.current = setTimeout(setPhase, PHASE_DELAYS['council-spinning'], 'council-spinning');
    return clearTimers;
  }, [isMounted, phase, clearTimers]);

  // Phase 3: Council spinning — then show context briefing
  useEffect(() => {
    if (!isMounted || phase !== 'council-spinning') {
      return;
    }
    timeoutRef.current = setTimeout(() => {
      setPhase('context-briefing');
    }, PHASE_DELAYS['context-briefing']);
    return clearTimers;
  }, [isMounted, phase, clearTimers]);

  // Phase 4: Context briefing — type the briefing, then start streaming
  useEffect(() => {
    if (!isMounted || phase !== 'context-briefing') {
      return;
    }
    let charIdx = 0;

    intervalRef.current = setInterval(() => {
      charIdx += TYPING_CHARS_PER_FRAME;
      if (charIdx >= resolvedContext.length) {
        setContextBriefingText(resolvedContext);
        clearTimers();
        timeoutRef.current = setTimeout(() => {
          setPhase('streaming-responses');
          setActiveModelIdx(0);
        }, PHASE_DELAYS['start-responses']);
      } else {
        setContextBriefingText(resolvedContext.slice(0, charIdx));
      }
    }, TYPING_FRAME_INTERVAL);

    return clearTimers;
  }, [isMounted, phase, clearTimers, resolvedContext]);

  // Phase 5: Stream model responses
  const streamModel = useCallback((idx: number) => {
    const fullText = resolvedModels[idx]?.text ?? '';
    let charIdx = 0;

    clearTimers();

    intervalRef.current = setInterval(() => {
      charIdx += TYPING_CHARS_PER_FRAME;
      const newText = fullText.slice(0, Math.min(charIdx, fullText.length));

      setModelTexts((prev) => {
        const next = [...prev];
        next[idx] = newText;
        return next;
      });

      if (charIdx >= fullText.length) {
        clearTimers();
        setTimeout(() => {
          if (idx < resolvedModels.length - 1) {
            setActiveModelIdx(idx + 1);
          } else {
            setPhase('streaming-verdict');
          }
        }, 400);
      }
    }, TYPING_FRAME_INTERVAL);
  }, [clearTimers, resolvedModels]);

  useEffect(() => {
    if (!isMounted || phase !== 'streaming-responses' || activeModelIdx < 0 || activeModelIdx >= resolvedModels.length) {
      return;
    }
    streamModel(activeModelIdx);
    return clearTimers;
  }, [isMounted, phase, activeModelIdx, streamModel, clearTimers, resolvedModels]);

  // Phase 6: Stream verdict
  useEffect(() => {
    if (!isMounted || phase !== 'streaming-verdict') {
      return;
    }
    let charIdx = 0;

    intervalRef.current = setInterval(() => {
      charIdx += TYPING_CHARS_PER_FRAME;
      const newText = resolvedVerdict.slice(0, Math.min(charIdx, resolvedVerdict.length));
      setVerdictText(newText);

      if (charIdx >= resolvedVerdict.length) {
        clearTimers();
        timeoutRef.current = setTimeout(setPhase, PHASE_DELAYS['agent-continue'], 'agent-continue');
      }
    }, TYPING_FRAME_INTERVAL);

    return clearTimers;
  }, [isMounted, phase, clearTimers, resolvedVerdict]);

  // Phase 6: Agent continues — type the empowered follow-up
  useEffect(() => {
    if (!isMounted || phase !== 'agent-continue') {
      return;
    }
    let charIdx = 0;

    intervalRef.current = setInterval(() => {
      charIdx += TYPING_CHARS_PER_FRAME;
      if (charIdx >= resolvedContinue.length) {
        setAgentContinueText(resolvedContinue);
        clearTimers();
        setPhase('complete');
      } else {
        setAgentContinueText(resolvedContinue.slice(0, charIdx));
      }
    }, TYPING_FRAME_INTERVAL);

    return clearTimers;
  }, [isMounted, phase, clearTimers, resolvedContinue]);

  const phaseOrder = PHASE_VALUES;
  const phaseIdx = phaseOrder.indexOf(phase);
  const pastPhase = (p: Phase) => phaseIdx > phaseOrder.indexOf(p);
  const atOrPast = (p: Phase) => phaseIdx >= phaseOrder.indexOf(p);

  const showUserInvoke = atOrPast('user-invoke');
  const showCouncilSpinning = atOrPast('council-spinning');
  const showContextBriefing = atOrPast('context-briefing');
  const showResponses = atOrPast('streaming-responses');
  const showVerdict = atOrPast('streaming-verdict');
  const showAgentContinue = atOrPast('agent-continue');
  const showCursor = phase !== 'complete';

  return (
    <div className={cn(
      'flex flex-col overflow-hidden text-left w-full min-w-0',
      !chromeless && 'rounded-2xl border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)]',
    )}
    >
      {/* Title bar with traffic lights */}
      {!chromeless && (
        <div className="flex items-center h-8 sm:h-9 bg-[rgba(30,30,30,0.9)] px-3 gap-3 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="size-2.5 sm:size-3 rounded-full bg-[#ff5f56]" />
            <div className="size-2.5 sm:size-3 rounded-full bg-[#ffbd2e]" />
            <div className="size-2.5 sm:size-3 rounded-full bg-[#27ca3f]" />
          </div>
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">claude code</span>
        </div>
      )}

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className={cn(
          'bg-[#0a0a0a] p-3 sm:p-4 md:p-6 font-mono text-xs sm:text-sm leading-relaxed overflow-y-auto overflow-x-hidden break-words min-w-0',
          chromeless ? 'h-full min-h-[320px] sm:min-h-[400px] shadow-[inset_0_0_80px_rgba(0,0,0,0.4)]' : 'h-[360px] sm:h-[480px] md:h-[540px]',
        )}
      >
        {/* Session banner */}
        <SessionBanner />

        {/* Agent working */}
        <div>
          <span className="text-[#D97757] select-none">
            claude
            {'  '}
          </span>
          <span className="text-gray-300">
            {agentWorkingText}
            {phase === 'agent-working' && agentWorkingText && <BlinkingCursor />}
          </span>
        </div>

        {/* User invokes council */}
        {showUserInvoke && (
          <div className="mt-4">
            <span className="text-green-400 select-none">
              you &rsaquo;
              {'  '}
            </span>
            <span className="text-green-300">{resolvedUserInvoke}</span>
          </div>
        )}

        {/* Council spinning — MCP tool invocation style */}
        {showCouncilSpinning && (
          <div className="mt-4 space-y-1">
            <div>
              <span className="text-green-400">&#x23FA;</span>
              {' '}
              <span className="text-gray-300">debatekit.consult</span>
            </div>
            <div className="ml-5 text-gray-500 italic">
              &#x27F3;
              {' '}
              {resolvedModels.length}
              {' '}
              models deliberating...
            </div>
          </div>
        )}

        {/* Context briefing */}
        {showContextBriefing && contextBriefingText && (
          <div className="mt-3 ml-9 text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-500">Context:</span>
            {' '}
            {contextBriefingText}
            {phase === 'context-briefing' && <BlinkingCursor />}
          </div>
        )}

        {/* Model responses */}
        {showResponses && resolvedModels.map((model, idx) => {
          if (idx > activeModelIdx && phase === 'streaming-responses') {
            return null;
          }
          if (!pastPhase('streaming-responses') && idx > activeModelIdx) {
            return null;
          }
          const text = (idx === activeModelIdx && phase === 'streaming-responses') ? modelTexts[idx] : resolvedModels[idx]?.text;
          const isStreaming = idx === activeModelIdx && phase === 'streaming-responses';

          return (
            <div key={model.label} className="mt-4">
              <div className={cn('text-sm font-bold mb-1', getModelBrandColor(model.label))}>
                {model.label}
              </div>
              <div className="text-gray-400 pl-3 border-l-2 border-white/[0.06]">
                {text}
                {isStreaming && <BlinkingCursor />}
              </div>
            </div>
          );
        })}

        {/* Verdict */}
        {showVerdict && (
          <div className="mt-4">
            <div className="mb-1">
              <span className="text-green-400">&#x23FA;</span>
              {' '}
              <span className="text-green-400">Verdict</span>
            </div>
            <div className="ml-5 pl-3 border-l-2 border-green-400/30">
              <div className="text-green-400/90">
                {verdictText}
                {phase === 'streaming-verdict' && <BlinkingCursor />}
              </div>
            </div>
          </div>
        )}

        {/* Agent continues */}
        {showAgentContinue && (
          <div className="mt-4">
            <span className="text-[#D97757] select-none">
              claude
              {'  '}
            </span>
            <span className="text-gray-300">
              {agentContinueText}
              {phase === 'agent-continue' && <BlinkingCursor />}
            </span>
          </div>
        )}

        {/* Final cursor */}
        {phase === 'complete' && (
          <div className="mt-4 text-gray-500">
            $
            {' '}
            <BlinkingCursor />
          </div>
        )}

        {/* Keep scroll anchor */}
        {showCursor && <div className="h-1" />}
      </div>
    </div>
  );
});
