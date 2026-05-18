/**
 * Podcast Script Generator Service
 *
 * Transforms thread messages into structured podcast dialogue (DbPodcastScript).
 * Features mode-aware narration, ElevenLabs v3 audio tags, reaction lines,
 * content signal detection, and natural conversational flow.
 */

import type { ChatMode } from '@debatekit/shared/enums';
import { ChatModeSchema, PodcastScriptLineRoles } from '@debatekit/shared/enums';
import { z } from 'zod';

import type { DbPodcastScript, DbPodcastScriptLine } from '@/db/schemas/chat-metadata';
import { extractModelName } from '@/lib/utils/ai-display';

import { FALLBACK_VOICE_POOL, getModeratorVoice, getNarratorVoice, getVoiceForModel } from './voice-map';

// ============================================================================
// CONTENT SIGNAL — 5-PART ENUM PATTERN
// ============================================================================

const CONTENT_SIGNALS = [
  'agreement',
  'caution',
  'confidence',
  'curiosity',
  'disagreement',
  'emphasis',
  'excitement',
  'frustration',
  'humor',
  'insight',
  'question',
  'surprise',
] as const;

const _ContentSignalSchema = z.enum(CONTENT_SIGNALS);

type ContentSignal = z.infer<typeof _ContentSignalSchema>;

export const DEFAULT_CONTENT_SIGNAL: ContentSignal = 'emphasis';

const ContentSignals = {
  AGREEMENT: 'agreement' as const,
  CAUTION: 'caution' as const,
  CONFIDENCE: 'confidence' as const,
  CURIOSITY: 'curiosity' as const,
  DISAGREEMENT: 'disagreement' as const,
  EMPHASIS: 'emphasis' as const,
  EXCITEMENT: 'excitement' as const,
  FRUSTRATION: 'frustration' as const,
  HUMOR: 'humor' as const,
  INSIGHT: 'insight' as const,
  QUESTION: 'question' as const,
  SURPRISE: 'surprise' as const,
} as const;

// ============================================================================
// REACTION STYLES — 5-PART ENUM PATTERN
// ============================================================================

const REACTION_STYLES = [
  'analytical',
  'building',
  'challenging',
  'constructive',
] as const;

const ReactionStyleSchema = z.enum(REACTION_STYLES);

type ReactionStyle = z.infer<typeof ReactionStyleSchema>;

export const DEFAULT_REACTION_STYLE: ReactionStyle = 'analytical';

export const ReactionStyles = {
  ANALYTICAL: 'analytical' as const,
  BUILDING: 'building' as const,
  CHALLENGING: 'challenging' as const,
  CONSTRUCTIVE: 'constructive' as const,
} as const;

// ============================================================================
// TYPES (Zod schemas with z.infer<>)
// ============================================================================

const _PodcastSpeakerSchema = z.object({
  modelId: z.string(),
  name: z.string(),
  participantId: z.string(),
  role: z.string().nullable(),
  voiceId: z.string(),
});

type PodcastSpeaker = z.infer<typeof _PodcastSpeakerSchema>;

const _ScriptInputMessageSchema = z.object({
  content: z.string(),
  participantId: z.string().nullable(),
  role: z.string(),
  roundNumber: z.number(),
});

type ScriptInputMessage = z.infer<typeof _ScriptInputMessageSchema>;

const _PreSearchQuerySchema = z.object({
  query: z.string(),
  rationale: z.string(),
});

const _PreSearchInputSchema = z.object({
  queries: z.array(_PreSearchQuerySchema),
  summary: z.string(),
  totalResults: z.number(),
});

type PreSearchInput = z.infer<typeof _PreSearchInputSchema>;

const _ScriptGeneratorInputParticipantSchema = z.object({
  id: z.string(),
  modelId: z.string(),
  role: z.string().nullable(),
});

const _ScriptGeneratorInputSchema = z.object({
  messages: z.array(_ScriptInputMessageSchema),
  mode: ChatModeSchema,
  /** Council moderator's actual synthesis content (replaces generic buildSynthesis) */
  moderatorSynthesis: z.string().optional(),
  participants: z.array(_ScriptGeneratorInputParticipantSchema),
  preSearchData: _PreSearchInputSchema.optional(),
  /** Number of prior completed round podcasts (for episode continuity) */
  priorRoundCount: z.number().optional(),
  threadTitle: z.string(),
  userPrompt: z.string().optional(),
});

type ScriptGeneratorInput = z.infer<typeof _ScriptGeneratorInputSchema>;

const _ModeConfigSchema = z.object({
  connectorPool: z.array(z.string()),
  discussionVerb: z.string(),
  interruptionEnabled: z.boolean(),
  reactionFrequency: z.number(),
  reactionStyle: ReactionStyleSchema,
});

type ModeConfig = z.infer<typeof _ModeConfigSchema>;

// ============================================================================
// MODE CONFIGURATION
// ============================================================================

const MODE_CONFIGS = {
  analyzing: {
    connectorPool: [
      'Looking at this from another angle,',
      'The data suggests something interesting here.',
      'What stands out to me is',
      'Breaking this down further,',
      'There\'s a nuance here worth noting.',
      'If we examine the evidence,',
      'One pattern I\'m seeing is',
      'To add some rigor to this,',
      'The underlying logic suggests',
      'Stepping back for a moment,',
      'This connects to a broader point.',
      'Let me parse this more carefully.',
      'There\'s a subtlety we\'re missing.',
      'Cross-referencing what we know,',
      'The critical factor here is',
    ],
    discussionVerb: 'analysis',
    interruptionEnabled: false,
    reactionFrequency: 0.25,
    reactionStyle: 'analytical',
  },
  brainstorming: {
    connectorPool: [
      'Building on that,',
      'Oh, that sparks an idea!',
      'What if we also considered',
      'That reminds me of something.',
      'Here\'s a wild thought:',
      'Okay hear me out on this one --',
      'Piggybacking off that,',
      'What if we flipped it entirely?',
      'This is unpolished but --',
      'Oh! And what about',
      'Running with that idea,',
      'Let me throw something crazy out there.',
      'That actually connects to',
      'Wait, I just thought of something.',
      'Building off that tangent,',
    ],
    discussionVerb: 'brainstorm',
    interruptionEnabled: false,
    reactionFrequency: 0.4,
    reactionStyle: 'building',
  },
  debating: {
    connectorPool: [
      'I see it differently.',
      'That\'s a fair point, but consider this.',
      'I have to push back on that.',
      'While I understand that perspective,',
      'Here\'s where I disagree.',
      'With all due respect,',
      'That argument doesn\'t hold up because',
      'I\'d challenge that assumption.',
      'Let me offer a counterpoint.',
      'That\'s precisely the problem --',
      'Sure, but you\'re overlooking',
      'I take the opposite view.',
      'That logic breaks down when',
      'Respectfully, that misses the mark.',
      'There\'s a flaw in that reasoning.',
    ],
    discussionVerb: 'debate',
    interruptionEnabled: true,
    reactionFrequency: 0.5,
    reactionStyle: 'challenging',
  },
  solving: {
    connectorPool: [
      'To build on that solution,',
      'One practical approach would be',
      'Let me add a constraint we should consider.',
      'That could work. Here\'s how we refine it.',
      'From an implementation standpoint,',
      'The next step would be',
      'We could optimize that by',
      'Here\'s how I\'d de-risk that approach.',
      'To make that actionable,',
      'Building on the framework so far,',
      'Let me propose a concrete step.',
      'That gives us a starting point for',
      'To put a finer point on it,',
      'The bottleneck here is',
      'Here\'s a pragmatic way forward.',
    ],
    discussionVerb: 'problem-solving session',
    interruptionEnabled: false,
    reactionFrequency: 0.3,
    reactionStyle: 'constructive',
  },
} satisfies Record<ChatMode, ModeConfig>;

// ============================================================================
// CONTENT SIGNAL DETECTION
// ============================================================================

const SIGNAL_PATTERNS: Array<{ pattern: RegExp; signal: ContentSignal }> = [
  { pattern: /\?\s*$/m, signal: ContentSignals.QUESTION },
  { pattern: /\b(agree|absolutely|exactly|indeed|correct|right)\b/i, signal: ContentSignals.AGREEMENT },
  { pattern: /\b(disagree|however|but|contrary|wrong|incorrect|flawed)\b/i, signal: ContentSignals.DISAGREEMENT },
  { pattern: /\b(funny|hilarious|joke|lol|haha|ironic|amusing)\b/i, signal: ContentSignals.HUMOR },
  { pattern: /\b(surprising|unexpected|remarkable|incredible|wow|fascinating)\b/i, signal: ContentSignals.SURPRISE },
  { pattern: /\b(careful|caution|warning|risk|danger|beware|concern)\b/i, signal: ContentSignals.CAUTION },
  { pattern: /\b(critical|essential|crucial|key|fundamental|important)\b/i, signal: ContentSignals.EMPHASIS },
  { pattern: /\b(confident|certain|no doubt|clearly|obviously|definitively)\b/i, signal: ContentSignals.CONFIDENCE },
  { pattern: /\b(curious|wondering|what if|could it|how come|puzzling)\b/i, signal: ContentSignals.CURIOSITY },
  { pattern: /\b(exciting|thrilling|amazing|brilliant|love this|fantastic)\b/i, signal: ContentSignals.EXCITEMENT },
  { pattern: /\b(frustrat|annoying|irritat|problematic|why can't|bothers me)\b/i, signal: ContentSignals.FRUSTRATION },
  { pattern: /\b(insight|reali[sz]e|aha|eureka|it hits me|dawned on|key takeaway)\b/i, signal: ContentSignals.INSIGHT },
];

function detectContentSignals(text: string): ContentSignal[] {
  const signals: ContentSignal[] = [];
  const seen = new Set<ContentSignal>();

  for (const { pattern, signal } of SIGNAL_PATTERNS) {
    if (!seen.has(signal) && pattern.test(text)) {
      signals.push(signal);
      seen.add(signal);
    }
  }

  return signals;
}

// ============================================================================
// AUDIO TAG INJECTION
// ============================================================================

const SIGNAL_TO_TAG = {
  agreement: '[enthusiastic]',
  caution: '[thoughtful]',
  confidence: '[confident]',
  curiosity: '[curious]',
  disagreement: '[thoughtful]',
  emphasis: '[confident]',
  excitement: '[excited]',
  frustration: '[frustrated]',
  humor: '[laughs]',
  insight: '[gasps]',
  question: '[curious]',
  surprise: '[excited]',
} as const satisfies Record<ContentSignal, string>;

/** Mode-specific tag overrides for richer emotional variety */
const MODE_TAG_OVERRIDES: Record<ChatMode, Partial<Record<ContentSignal, string>>> = {
  analyzing: {
    excitement: '[thoughtful]',
    humor: '[cheerfully]',
    surprise: '[curious]',
  },
  brainstorming: {
    agreement: '[excited]',
    confidence: '[enthusiastic]',
    disagreement: '[playfully]',
  },
  debating: {
    agreement: '[thoughtful]',
    confidence: '[passionate]',
    disagreement: '[passionate]',
    frustration: '[cuts in]',
  },
  solving: {
    excitement: '[confident]',
    humor: '[cheerfully]',
    insight: '[enthusiastic]',
  },
};

function getOpeningTag(signals: ContentSignal[], mode: ChatMode): string {
  const primary = signals[0];
  if (!primary) {
    return '';
  }

  const modeOverride = MODE_TAG_OVERRIDES[mode][primary];
  if (modeOverride) {
    return modeOverride;
  }

  return SIGNAL_TO_TAG[primary] ?? '';
}

/**
 * Deterministic hash from two strings -- returns consistent index for same speaker pair.
 */
function deterministicIndex(a: string, b: string, max: number): number {
  let hash = 0;
  const combined = `${a}:${b}`;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % max;
}

// ============================================================================
// NATURAL SPEECH FILLERS
// ============================================================================

const SENTENCE_START_FILLERS = [
  'So, ',
  'Well, ',
  'You know, ',
  'I mean, ',
  'Right, so ',
  'Okay so ',
  'Look, ',
  'Here\'s the thing, ',
] as const;

const MID_SENTENCE_FILLERS = [
  ', um,',
  ', uh,',
  '... ',
  ', like,',
  ', you know,',
  '-- ',
] as const;

const THINKING_PAUSES = [
  '... ',
  '... hmm, ',
  '... well, ',
  '... let me think... ',
] as const;

const MODE_FILLER_FREQUENCY: Record<ChatMode, number> = {
  analyzing: 0.1,
  brainstorming: 0.25,
  debating: 0.15,
  solving: 0.15,
};

// ============================================================================
// SPEAKER PERSONALITY PROFILES
// ============================================================================

/**
 * Personality traits that influence speech patterns.
 * Mapped from AI model families to create distinct speaker characters.
 */
const SPEAKER_PERSONALITIES: Record<string, {
  /** Multiplier for filler frequency (1.0 = default, 0.5 = half, 1.5 = more) */
  fillerMultiplier: number;
  /** Preferred opening tag when no signal detected */
  neutralTag: string;
  /** How often this speaker uses their neutral tag (0-1) */
  neutralTagFrequency: number;
}> = {
  anthropic: { fillerMultiplier: 0.8, neutralTag: '[thoughtful]', neutralTagFrequency: 0.3 },
  google: { fillerMultiplier: 1.0, neutralTag: '[curious]', neutralTagFrequency: 0.2 },
  meta: { fillerMultiplier: 1.3, neutralTag: '[enthusiastic]', neutralTagFrequency: 0.25 },
  mistral: { fillerMultiplier: 0.9, neutralTag: '[confident]', neutralTagFrequency: 0.2 },
  openai: { fillerMultiplier: 1.1, neutralTag: '[cheerfully]', neutralTagFrequency: 0.15 },
};

const DEFAULT_PERSONALITY = { fillerMultiplier: 1.0, neutralTag: '', neutralTagFrequency: 0 };

/**
 * Look up personality by model ID. Matches the model provider prefix.
 */
function getPersonality(modelId: string) {
  for (const [provider, personality] of Object.entries(SPEAKER_PERSONALITIES)) {
    if (modelId.toLowerCase().includes(provider)) {
      return personality;
    }
  }
  return DEFAULT_PERSONALITY;
}

/**
 * Injects natural speech fillers (start fillers, mid-sentence fillers, thinking pauses)
 * into text to make TTS output sound more conversational. Uses deterministicIndex
 * for reproducible selection. Never modifies the first sentence.
 */
function naturalizeText(text: string, mode: ChatMode, seed: string, fillerMultiplier = 1.0): string {
  const frequency = MODE_FILLER_FREQUENCY[mode] * fillerMultiplier;
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g);

  if (!sentences || sentences.length < 2) {
    return text;
  }

  const result: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    let sentence = sentences[i] ?? '';

    // Never add fillers to the first sentence
    if (i === 0) {
      result.push(sentence);
      continue;
    }

    // Thinking pause: occasionally replace a sentence start with a longer pause
    const thinkHash = deterministicIndex(seed, `think:${i}`, 100);
    if (thinkHash < frequency * 30) {
      const pauseIdx = deterministicIndex(seed, `tp:${i}`, THINKING_PAUSES.length);
      const pause = THINKING_PAUSES[pauseIdx] ?? THINKING_PAUSES[0];
      const trimmed = sentence.trimStart();
      sentence = `${pause}${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
      result.push(sentence);
      continue;
    }

    // Sentence-start filler
    const startHash = deterministicIndex(seed, `start:${i}`, 100);
    if (startHash < frequency * 100) {
      const fillerIdx = deterministicIndex(seed, `sf:${i}`, SENTENCE_START_FILLERS.length);
      const filler = SENTENCE_START_FILLERS[fillerIdx] ?? SENTENCE_START_FILLERS[0];
      const trimmed = sentence.trimStart();
      sentence = `${filler}${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
    }

    // Mid-sentence filler (at ~half the start-filler frequency)
    const midHash = deterministicIndex(seed, `mid:${i}`, 100);
    if (midHash < frequency * 50) {
      const commaIdx = sentence.indexOf(',');
      if (commaIdx > 5 && commaIdx < sentence.length - 10) {
        const fillerIdx = deterministicIndex(seed, `mf:${i}`, MID_SENTENCE_FILLERS.length);
        const filler = MID_SENTENCE_FILLERS[fillerIdx] ?? MID_SENTENCE_FILLERS[0];
        sentence = `${sentence.slice(0, commaIdx)}${filler}${sentence.slice(commaIdx + 1)}`;
      }
    }

    result.push(sentence);
  }

  return result.join('');
}

/**
 * Enhance text with punctuation-based pacing cues for ElevenLabs v3.
 * v3 interprets: CAPS for emphasis, ellipses for pauses, dashes for interruptions.
 */
function enhancePacing(text: string, mode: ChatMode, seed: string): string {
  let result = text;

  // Capitalize key emphasis words (v3 reads these with stress)
  // Only in debating and analyzing modes where emphasis matters
  if (mode === 'debating' || mode === 'analyzing') {
    result = result.replace(
      /\b(never|always|absolutely|fundamentally|critical|essential|impossible|must|cannot)\b/gi,
      (match) => {
        // Only capitalize ~40% of matches for natural feel
        const hash = deterministicIndex(seed, match.toLowerCase(), 100);
        return hash < 40 ? match.toUpperCase() : match;
      },
    );
  }

  // Add dramatic pauses before "but", "however" (replace comma with ellipsis)
  result = result.replace(/, (but|however|yet|still)/gi, (_, word) => `... ${word}`);

  // Add dash-based interruption pacing before strong statements in debates
  if (mode === 'debating') {
    result = result.replace(/\. (No|Wrong|Actually|Wait)/g, '. -- $1');
  }

  return result;
}

// ============================================================================
// CONTENT TRANSFORMATION
// ============================================================================

/** Default per-speaker budget when no dynamic budget is provided */
const DEFAULT_CONTENT_BUDGET = 3000;

/** Long responses get a breathing tag prepended */
const BREATHING_THRESHOLD_CHARS = 800;

/**
 * Smart truncation that preserves both opening arguments and conclusions.
 * Instead of keeping only the first N chars + one closing sentence,
 * this extracts the opening section (~60%) and closing section (~35%)
 * to preserve the full arc of the speaker's argument.
 */
function smartTruncate(text: string, budget: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g);

  if (!sentences || sentences.length <= 2) {
    const cutAt = text.lastIndexOf('.', budget);
    return cutAt > budget * 0.5 ? text.slice(0, cutAt + 1).trim() : text.slice(0, budget).trim();
  }

  // Opening: ~60% of budget — establishes the argument
  const openingBudget = Math.floor(budget * 0.6);
  const openingSentences: string[] = [];
  let openingLen = 0;
  for (const s of sentences) {
    if (openingLen + s.length > openingBudget && openingSentences.length > 0) {
      break;
    }
    openingSentences.push(s);
    openingLen += s.length;
  }

  // Closing: ~35% of budget from the end — preserves the conclusion
  const closingBudget = Math.floor(budget * 0.35);
  const closingSentences: string[] = [];
  let closingLen = 0;
  for (let i = sentences.length - 1; i >= openingSentences.length; i--) {
    const s = sentences[i];
    if (!s) {
      continue;
    }
    if (closingLen + s.length > closingBudget && closingSentences.length > 0) {
      break;
    }
    closingSentences.unshift(s);
    closingLen += s.length;
  }

  const opening = openingSentences.join('').trim();

  if (closingSentences.length > 0) {
    const closing = closingSentences.join('').trim();
    return `${opening} And to bring this together: ${closing}`;
  }

  return opening;
}

function transformContentForAudio(
  text: string,
  signals: ContentSignal[],
  mode: ChatMode,
  isFirstSpeaker: boolean,
  speakerSeed?: string,
  modelId?: string,
  contentBudget?: number,
): string {
  const budget = contentBudget ?? DEFAULT_CONTENT_BUDGET;

  // 1. Clean markdown/code/URLs first
  let cleaned = cleanForAudio(text);

  // 2. Smart truncation: preserve opening arguments and conclusions
  if (cleaned.length > budget) {
    cleaned = smartTruncate(cleaned, budget);

    // Hard cap — should rarely trigger with proper budgeting
    const hardCap = budget + Math.floor(budget * 0.15);
    if (cleaned.length > hardCap) {
      const hardCut = cleaned.lastIndexOf('.', hardCap);
      cleaned = hardCut > budget ? cleaned.slice(0, hardCut + 1).trim() : cleaned.slice(0, hardCap).trim();
    }
  }

  // 3. Naturalize with speech fillers (participant lines only, controlled by speakerSeed)
  if (speakerSeed) {
    const personality = modelId ? getPersonality(modelId) : DEFAULT_PERSONALITY;
    cleaned = naturalizeText(cleaned, mode, speakerSeed, personality.fillerMultiplier);
  }

  // 3b. Enhance pacing with punctuation cues
  if (speakerSeed) {
    cleaned = enhancePacing(cleaned, mode, speakerSeed);
  }

  // 4. Add breathing tag for long responses
  if (cleaned.length > BREATHING_THRESHOLD_CHARS) {
    cleaned = `[breathes] ${cleaned}`;
  }

  // 5. Add conversational connector for non-first speakers
  if (!isFirstSpeaker) {
    const config = MODE_CONFIGS[mode];
    const connectorIdx = deterministicIndex(cleaned.slice(0, 20), mode, config.connectorPool.length);
    const connector = config.connectorPool[connectorIdx];
    if (connector) {
      cleaned = `${connector} ${cleaned}`;
    }
  }

  // 6. Prepend audio tag based on content signals
  const tag = getOpeningTag(signals, mode);
  if (tag) {
    cleaned = `${tag} ${cleaned}`;
  }

  // 7. Personality-based neutral tag when no content signal detected
  if (modelId && signals.length === 0) {
    const personality = getPersonality(modelId);
    if (personality.neutralTag) {
      const tagHash = deterministicIndex(speakerSeed ?? modelId, `neutral`, 100);
      if (tagHash < personality.neutralTagFrequency * 100) {
        cleaned = `${personality.neutralTag} ${cleaned}`;
      }
    }
  }

  return cleaned;
}

// ============================================================================
// MODERATOR TEMPLATES (Mode-Aware)
// ============================================================================

function buildIntro(
  title: string,
  speakers: PodcastSpeaker[],
  mode: ChatMode,
  userPrompt?: string,
  priorRoundCount?: number,
): string {
  const config = MODE_CONFIGS[mode];
  const nameList = speakers.map(s =>
    s.role ? `${getShortName(s)}, our ${s.role}` : getShortName(s),
  );
  const names = formatNameList(nameList);

  if (priorRoundCount && priorRoundCount > 0) {
    return `Welcome back to episode ${priorRoundCount + 1} of our DebateKit ${config.discussionVerb} on "${title}". Our panel is back: ${names}. Let's dive deeper into the conversation.`;
  }

  const promptFrame = userPrompt
    ? ` Today's question: "${userPrompt.length > 250 ? `${userPrompt.slice(0, 250)}...` : userPrompt}".`
    : '';

  const modeFraming = {
    analyzing: 'We\'ll examine this from multiple angles and see where the evidence leads us.',
    brainstorming: 'The goal is wild ideas -- nothing is off the table.',
    debating: 'Expect some sparks to fly as our panelists defend their positions.',
    solving: 'Let\'s work through this systematically and find actionable solutions.',
  } as const satisfies Record<ChatMode, string>;

  return `Welcome to this DebateKit ${config.discussionVerb} on "${title}". I'm your moderator, and we have an incredible panel: ${names}.${promptFrame} ${modeFraming[mode]} Let's get started.`;
}

function buildPreSearchNarration(preSearch: PreSearchInput): string {
  const queryList = preSearch.queries.slice(0, 3).map(q => q.query);
  const queryText = queryList.length > 0
    ? ` We searched for ${formatNameList(queryList.map(q => `"${q}"`))}`
    : '';

  const summary = preSearch.summary;
  let trimmedSummary: string;
  if (summary.length > 500) {
    const cutAt = summary.lastIndexOf('.', 500);
    trimmedSummary = cutAt > 250 ? summary.slice(0, cutAt + 1).trim() : `${summary.slice(0, 500).trim()}...`;
  } else {
    trimmedSummary = summary;
  }

  return `Before we begin, our team did some research to ground this discussion.${queryText} and found ${preSearch.totalResults} sources. ${trimmedSummary}`;
}

function buildSpeakerIntro(speaker: PodcastSpeaker, mode: ChatMode): string {
  const shortName = getShortName(speaker);
  const config = MODE_CONFIGS[mode];

  const commitment = {
    analyzing: 'I\'ll bring a careful analytical lens to this.',
    brainstorming: 'I\'m here to push creative boundaries.',
    debating: 'I\'m ready to defend my position.',
    solving: 'Let\'s find practical solutions together.',
  } as const satisfies Record<ChatMode, string>;

  if (speaker.role) {
    return `Hi, I'm ${shortName}, serving as the ${speaker.role}. ${commitment[mode]}`;
  }

  return `Hi, I'm ${shortName}. ${commitment[mode] ?? `Let me share my perspective on this ${config.discussionVerb}.`}`;
}

/**
 * Build a thesis-framing statement that sets up the key tension/question.
 * Placed after speaker intros and before dialogue begins.
 * NotebookLM-style: frames what the audience should listen for.
 */
function buildThesisFraming(mode: ChatMode, speakerCount: number): string {
  const framings = {
    analyzing: [
      `So here\'s the central question for our ${speakerCount} panelists: what are we really looking at here, and what does the evidence tell us?`,
      `The key tension I want us to explore: where do the facts point, and where might our assumptions be leading us astray?`,
    ],
    brainstorming: [
      `Alright, the challenge is on the table. Let\'s see who can push the thinking furthest. Remember -- no idea is too wild at this stage.`,
      `I want each of you to surprise me. What\'s the angle nobody has considered yet?`,
    ],
    debating: [
      `We\'ve got some fundamentally different perspectives in the room. I want to find out: who has the strongest argument, and can anyone change someone else\'s mind?`,
      `There\'s real disagreement here, and that\'s exactly what we need. Let\'s get to the heart of where you all diverge.`,
    ],
    solving: [
      `Here\'s what I need from the panel: not just ideas, but a concrete path forward. What would you actually do, starting tomorrow?`,
      `The bar is high today -- I want solutions that are practical, not just theoretical. Let\'s dig in.`,
    ],
  } as const satisfies Record<ChatMode, readonly string[]>;

  const options = framings[mode];
  // Use speaker count as a simple deterministic selector
  return options[speakerCount % options.length] ?? options[0] ?? '';
}

function buildSpeakerHandoff(
  speaker: PodcastSpeaker,
  isFirst: boolean,
  mode: ChatMode,
  prevSpeaker?: PodcastSpeaker,
  prevContentSignals: ContentSignal[] = [],
): string {
  const shortName = getShortName(speaker);

  if (isFirst) {
    return speaker.role
      ? `Let's start with ${shortName}, our ${speaker.role}. What are your thoughts?`
      : `Let's kick things off with ${shortName}. What's your take?`;
  }

  const prevName = prevSpeaker ? getShortName(prevSpeaker) : '';

  // --- Signal-aware transitions (when previous content had a strong signal) ---
  if (prevName && prevContentSignals.length > 0 && prevContentSignals[0]) {
    const primarySignal = prevContentSignals[0];

    const signalHandoffs: Partial<Record<ContentSignal, readonly string[]>> = {
      agreement: [
        `${prevName} and the panel seem aligned. ${shortName}, do you share that view?`,
        `Sounds like common ground is forming. ${shortName}, where do you stand?`,
        `A lot of agreement in the room. ${shortName}, does that hold up for you?`,
        `The consensus is building. ${shortName}, anything to add or push back on?`,
      ],
      disagreement: [
        `Clearly some tension here. ${shortName}, how do you see it?`,
        `${prevName} isn't buying it. ${shortName}, can you weigh in?`,
        `We've got a fault line forming. ${shortName}, which side do you land on?`,
        `Strong pushback from ${prevName}. ${shortName}, your take?`,
      ],
      humor: [
        `[laughs] Alright, settling down. ${shortName}, bring us back on track.`,
        `${prevName} keeping it light. ${shortName}, your turn.`,
        `[cheerfully] Love the energy. ${shortName}, over to you.`,
      ],
      surprise: [
        `${prevName} just dropped something unexpected. ${shortName}, your reaction?`,
        `Didn't see that coming. ${shortName}, what do you make of it?`,
        `That's a revelation. ${shortName}, does that change your thinking?`,
      ],
    };

    const handoffOptions = signalHandoffs[primarySignal];
    if (handoffOptions && handoffOptions.length > 0) {
      const idx = deterministicIndex(speaker.participantId, primarySignal, handoffOptions.length);
      return handoffOptions[idx] ?? handoffOptions[0] ?? '';
    }
  }

  // --- Mode-specific handoff variations ---
  if (prevName) {
    const modeHandoffs = {
      analyzing: [
        `Interesting analysis from ${prevName}. ${shortName}, what does the evidence tell you?`,
        `${prevName} raises a key point. ${shortName}, how does that fit your framework?`,
        `Let's dig deeper. ${shortName}, your analytical take?`,
        `Thank you, ${prevName}. ${shortName}, what pattern do you see?`,
      ],
      brainstorming: [
        `Great ideas flowing from ${prevName}. ${shortName}, what does that spark for you?`,
        `Love that direction. ${shortName}, riff on it!`,
        `${prevName} opened a door. ${shortName}, run through it.`,
        `The creative energy is high. ${shortName}, what's your wild idea?`,
      ],
      debating: [
        `Strong points from ${prevName}. ${shortName}, your response?`,
        `${prevName} threw down the gauntlet. ${shortName}, your rebuttal?`,
        `A bold stance from ${prevName}. ${shortName}, do you agree or push back?`,
        `The floor is yours, ${shortName}. Make your case.`,
      ],
      solving: [
        `${prevName} laid some groundwork. ${shortName}, how do we build on it?`,
        `Good foundation from ${prevName}. ${shortName}, what's the next step?`,
        `Thank you, ${prevName}. ${shortName}, how would you implement that?`,
        `Practical input from ${prevName}. ${shortName}, refine the approach.`,
      ],
    } as const satisfies Record<ChatMode, readonly string[]>;

    const options = modeHandoffs[mode];
    const idx = deterministicIndex(speaker.participantId, prevName, options.length);
    return options[idx] ?? options[0] ?? '';
  }

  return speaker.role
    ? `Now let's hear from ${shortName}, our ${speaker.role}.`
    : `Over to you, ${shortName}.`;
}

function buildRoundTransition(roundNumber: number, speakerCount: number, mode: ChatMode): string {
  const config = MODE_CONFIGS[mode];

  const transitions = [
    `That was a great exchange between our ${speakerCount} panelists. Let's move into round ${roundNumber + 1} of this ${config.discussionVerb} and see how the conversation evolves.`,
    `Excellent points all around. Round ${roundNumber + 1} of our ${config.discussionVerb} begins now -- let's see where the panel takes us.`,
    `The discussion is heating up. Let's head into round ${roundNumber + 1} and push this ${config.discussionVerb} even further.`,
  ] as const;

  return transitions[roundNumber % transitions.length] ?? transitions[0] ?? '';
}

/**
 * Build a synthesis statement summarizing key discussion threads.
 * Placed before the closing to give the podcast a satisfying arc.
 */
function buildSynthesis(speakerNames: string[], mode: ChatMode): string {
  const syntheses = {
    analyzing: `Before we wrap up, let me pull the threads together. We\'ve heard ${speakerNames.length} distinct analytical lenses today, each revealing something the others missed. That\'s the power of this kind of deep dive.`,
    brainstorming: `What a session. We started with one question and ended up in places none of us expected. ${speakerNames.join(', ')} -- you\'ve each brought something unique to the table, and I think the best ideas came from building on each other.`,
    debating: `We\'ve had some real fireworks today. The disagreements weren\'t just surface-level -- there are genuinely different worldviews at play here. And honestly, I think both sides made points that are hard to dismiss.`,
    solving: `Let me recap where we\'ve landed. The panel converged on some key action items and surfaced constraints that any good solution needs to address. This is exactly the kind of practical progress we were aiming for.`,
  } as const satisfies Record<ChatMode, string>;

  return syntheses[mode];
}

function buildClosing(speakerNames: string[], mode: ChatMode, roundCount: number, hasMoreRounds?: boolean): string {
  const config = MODE_CONFIGS[mode];
  const roundLabel = roundCount === 1 ? '1 round' : `${roundCount} rounds`;

  if (hasMoreRounds) {
    return `What a fascinating ${roundLabel} of ${config.discussionVerb}. We've heard compelling perspectives from all our panelists. Stay tuned for the next episode as our experts continue to build on these ideas.`;
  }

  return `And that wraps up ${roundLabel} of today's DebateKit ${config.discussionVerb}. We've heard thoughtful perspectives from ${speakerNames.join(', ')}. Thank you all for an engaging discussion. Until next time.`;
}

// ============================================================================
// HELPERS
// ============================================================================

function getShortName(speaker: PodcastSpeaker): string {
  return speaker.name.split(' (')[0] || speaker.name;
}

function formatNameList(names: string[]): string {
  if (names.length <= 1) {
    return names[0] || '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ============================================================================
// SCRIPT GENERATION
// ============================================================================

function buildSpeakers(
  participants: ScriptGeneratorInput['participants'],
): Map<string, PodcastSpeaker> {
  const speakers = new Map<string, PodcastSpeaker>();
  const usedVoices = new Set<string>();
  let fallbackIndex = 0;
  let fallbackPoolIndex = 0;

  for (const p of participants) {
    let voiceId = getVoiceForModel(p.modelId, fallbackIndex);

    // Remap duplicate voices (e.g. Claude Opus 4.6/4.5/4 all map to "Adam")
    if (usedVoices.has(voiceId)) {
      let remapped = FALLBACK_VOICE_POOL[fallbackPoolIndex % FALLBACK_VOICE_POOL.length];
      while (remapped && usedVoices.has(remapped)) {
        fallbackPoolIndex++;
        remapped = FALLBACK_VOICE_POOL[fallbackPoolIndex % FALLBACK_VOICE_POOL.length];
      }
      if (remapped) {
        voiceId = remapped;
      }
      fallbackPoolIndex++;
    }
    usedVoices.add(voiceId);

    const modelName = extractModelName(p.modelId);
    const displayName = p.role
      ? `${modelName} (${p.role})`
      : modelName;

    speakers.set(p.id, {
      modelId: p.modelId,
      name: displayName,
      participantId: p.id,
      role: p.role,
      voiceId,
    });

    fallbackIndex++;
  }

  return speakers;
}

function groupByRound(messages: ScriptInputMessage[]): Map<number, ScriptInputMessage[]> {
  const rounds = new Map<number, ScriptInputMessage[]>();

  for (const msg of messages) {
    const existing = rounds.get(msg.roundNumber) ?? [];
    existing.push(msg);
    rounds.set(msg.roundNumber, existing);
  }

  return rounds;
}

/** Narrator = host/MC who introduces speakers, does handoffs, manages flow */
function narratorLine(text: string): DbPodcastScriptLine {
  return {
    role: PodcastScriptLineRoles.NARRATOR,
    speakerId: PodcastScriptLineRoles.NARRATOR,
    speakerName: 'Narrator',
    text,
    voiceId: getNarratorVoice(),
  };
}

/** Council Moderator = the actual moderator from the debatekit who gives opinion/synthesis */
function moderatorLine(text: string): DbPodcastScriptLine {
  return {
    role: PodcastScriptLineRoles.MODERATOR,
    speakerId: PodcastScriptLineRoles.MODERATOR,
    speakerName: 'Council Moderator',
    text,
    voiceId: getModeratorVoice(),
  };
}

function participantLine(speaker: PodcastSpeaker, text: string): DbPodcastScriptLine {
  return {
    role: PodcastScriptLineRoles.PARTICIPANT,
    speakerId: speaker.participantId,
    speakerName: speaker.name,
    text,
    voiceId: speaker.voiceId,
  };
}

/**
 * Generate a complete podcast script from thread messages.
 *
 * Structure:
 * 1. Narrator intro (host/MC introduces the show, topic, panelists)
 * 2. Pre-search narration by narrator (if web search happened)
 * 3. Speaker self-intros (first round only)
 * 4. For each message: narrator handoff -> participant content (proportionally budgeted)
 * 5. Narrator introduces the Council Moderator
 * 6. Council Moderator gives synthesis/opinion (if available)
 * 7. Narrator closing
 *
 * Total episode capped at ~5 minutes (~6500 chars).
 * Each participant's budget is proportional to their actual content length.
 */
export function generatePodcastScript(input: ScriptGeneratorInput): DbPodcastScript {
  const { mode } = input;
  const speakers = buildSpeakers(input.participants);
  const speakerList = [...speakers.values()];
  const speakerShortNames = speakerList.map(s => getShortName(s));
  const participantMessages = input.messages.filter(m => m.role === 'assistant' && m.participantId);
  const rounds = groupByRound(participantMessages);

  // ---- Proportional content budgets ----
  // Total episode target: ~6500 chars for ~5 min podcast
  const EPISODE_TARGET_CHARS = 6500;
  // Reserve chars for narrator overhead (intro, handoffs, transitions, closing)
  const narratorOverhead = 1200 + (speakerList.length * 80) + (Math.max(rounds.size - 1, 0) * 150);
  // Reserve chars for council moderator synthesis
  const moderatorBudget = input.moderatorSynthesis ? 600 : 300;
  const availableForParticipants = EPISODE_TARGET_CHARS - narratorOverhead - moderatorBudget;

  // Calculate each participant's raw content length for proportional allocation
  const participantContentLengths = new Map<string, number>();
  for (const msg of participantMessages) {
    if (!msg.participantId) {
      continue;
    }
    const cleaned = cleanForAudio(msg.content);
    const current = participantContentLengths.get(msg.participantId) ?? 0;
    participantContentLengths.set(msg.participantId, current + cleaned.length);
  }
  const totalRawContent = [...participantContentLengths.values()].reduce((sum, len) => sum + len, 0);

  // Per-participant budget proportional to how much they actually said
  const participantBudgets = new Map<string, number>();
  for (const [pid, rawLen] of participantContentLengths) {
    const proportion = totalRawContent > 0 ? rawLen / totalRawContent : 1 / Math.max(participantContentLengths.size, 1);
    const budget = Math.max(200, Math.floor(availableForParticipants * proportion));
    participantBudgets.set(pid, budget);
  }

  // Track per-participant chars used so far (across rounds)
  const participantCharsUsed = new Map<string, number>();

  const lines: DbPodcastScriptLine[] = [];

  // 1. Narrator intro
  lines.push(narratorLine(buildIntro(input.threadTitle, speakerList, mode, input.userPrompt, input.priorRoundCount)));

  // 2. Pre-search narration (narrator)
  if (input.preSearchData) {
    lines.push(narratorLine(buildPreSearchNarration(input.preSearchData)));
  }

  // Process each round
  const sortedRounds = [...rounds.entries()].sort(([a], [b]) => a - b);

  for (let i = 0; i < sortedRounds.length; i++) {
    const entry = sortedRounds[i];
    if (!entry) {
      continue;
    }
    const [, roundMessages] = entry;

    // Round transition (narrator)
    if (i > 0) {
      lines.push(narratorLine(buildRoundTransition(i, speakerList.length, mode)));
    }

    // 3. Speaker self-introductions (first round only)
    if (i === 0) {
      for (const speaker of speakerList) {
        lines.push(participantLine(speaker, buildSpeakerIntro(speaker, mode)));
      }

      // Thesis framing (narrator)
      lines.push(narratorLine(buildThesisFraming(mode, speakerList.length)));
    }

    // 4. Participant dialogue
    let isFirstInRound = true;
    let prevSpeaker: PodcastSpeaker | undefined;
    let prevSignals: ContentSignal[] = [];

    for (const msg of roundMessages) {
      if (!msg.participantId) {
        continue;
      }

      const speaker = speakers.get(msg.participantId);
      if (!speaker) {
        continue;
      }

      // Calculate remaining budget for this participant
      const totalBudget = participantBudgets.get(msg.participantId) ?? 500;
      const used = participantCharsUsed.get(msg.participantId) ?? 0;
      const remainingBudget = Math.max(200, totalBudget - used);

      // Narrator handoff (kept brief)
      const handoff = buildSpeakerHandoff(speaker, isFirstInRound, mode, prevSpeaker, prevSignals);
      lines.push(narratorLine(handoff));

      // Detect signals and transform content with proportional budget
      const signals = detectContentSignals(msg.content);
      const transformed = transformContentForAudio(msg.content, signals, mode, isFirstInRound, speaker.participantId, speaker.modelId, remainingBudget);

      if (transformed.length > 0) {
        lines.push(participantLine(speaker, transformed));
        participantCharsUsed.set(msg.participantId, used + transformed.length);
      }

      prevSpeaker = speaker;
      prevSignals = signals;
      isFirstInRound = false;
    }
  }

  // 5. Narrator introduces the Council Moderator, then moderator speaks
  if (input.moderatorSynthesis) {
    lines.push(narratorLine('Now let\'s hear from the Council Moderator, who has been synthesizing the discussion and forming their own perspective.'));

    const cleanedSynthesis = cleanForAudio(input.moderatorSynthesis);
    const modBudget = Math.min(cleanedSynthesis.length, moderatorBudget);
    let truncated: string;
    if (cleanedSynthesis.length > modBudget) {
      const cutAt = cleanedSynthesis.lastIndexOf('.', modBudget);
      truncated = cutAt > modBudget * 0.5 ? cleanedSynthesis.slice(0, cutAt + 1).trim() : cleanedSynthesis.slice(0, modBudget).trim();
    } else {
      truncated = cleanedSynthesis;
    }
    lines.push(moderatorLine(`Here's my take on everything we've discussed. ${truncated}`));
  } else {
    lines.push(narratorLine(buildSynthesis(speakerShortNames, mode)));
  }

  // 6. Narrator closing
  const isRoundScoped = input.priorRoundCount !== undefined;
  lines.push(narratorLine(buildClosing(speakerShortNames, mode, sortedRounds.length, isRoundScoped)));

  return {
    description: `DebateKit ${MODE_CONFIGS[mode].discussionVerb}: ${input.threadTitle}`,
    lines,
    title: input.threadTitle,
  };
}

/**
 * Calculate the total character count of a script.
 * Used for credit calculation and ElevenLabs billing estimation.
 */
export function getScriptCharacterCount(script: DbPodcastScript): number {
  return script.lines.reduce((sum, line) => sum + line.text.length, 0);
}

// ============================================================================
// EPISODE TITLE PROMPT
// ============================================================================

/**
 * Build a system prompt for generating a one-word episode title.
 * Used with generateText to create creative, evocative episode names.
 */
export function generateEpisodeTitlePrompt(userPrompt: string, threadTitle: string, roundNumber: number): string {
  return `You are a creative podcast episode naming assistant.
Generate exactly ONE evocative word that captures the essence of this round's discussion.
The word should work as a podcast episode subtitle -- think: "Genesis", "Clash", "Spark", "Pivot", "Eclipse".

Thread title: "${threadTitle}"
Round number: ${roundNumber + 1}
User's question: "${userPrompt}"

Reply with ONLY the single word, nothing else. No quotes, no punctuation, no explanation.`;
}

// ============================================================================
// SCRIPT CRITIQUE & REVISION
// ============================================================================

/**
 * Build an LLM prompt that critiques a generated podcast script and returns
 * a revised version with improved naturalness. The LLM should:
 * - Add more varied audio tags where appropriate
 * - Improve conversational flow between speakers
 * - Make moderator transitions feel less formulaic
 * - Add appropriate pauses and breathing cues
 * - Ensure emotional progression (not every line starts the same way)
 *
 * Returns the prompt string. The caller invokes the LLM and parses the result.
 */
export function buildScriptCritiquePrompt(script: DbPodcastScript): string {
  const scriptText = script.lines
    .map((line, i) => `[${i}] ${line.speakerName}: ${line.text}`)
    .join('\n');

  return `You are a podcast script editor specializing in natural-sounding dialogue for AI text-to-speech.

Review this podcast script and return a REVISED version. Each line should be on its own line in exactly the format: [INDEX] SPEAKER_NAME: REVISED_TEXT

Rules:
1. Keep the same number of lines and same speaker assignments
2. You may add ElevenLabs v3 audio tags: [laughs], [sighs], [excited], [curious], [thoughtful], [pause], [breathes], [cheerfully], [gasps], [whispers], [confident], [cuts in], [short pause]
3. Break up any line longer than 3 sentences into a more natural spoken rhythm
4. Vary how speakers start their turns -- avoid repetitive "Building on that" / "I agree" patterns
5. Make moderator transitions feel conversational, not robotic
6. Add 1-2 word interjections between major points: "Right.", "Exactly.", "Hmm.", "Interesting."
7. Do NOT change the meaning or core content of any line
8. Do NOT add new speakers or remove lines
9. Keep total character count similar (within 20%)

Script to revise:
${scriptText}

Return ONLY the revised lines in [INDEX] SPEAKER_NAME: TEXT format, nothing else.`;
}

/**
 * Parse the LLM's revised script output back into script lines.
 * Falls back to original lines for any that fail to parse.
 */
export function parseRevisedScript(original: DbPodcastScript, revisedText: string): DbPodcastScript {
  const revisedLines = revisedText.trim().split('\n');
  const updatedLines = [...original.lines];

  for (const revisedLine of revisedLines) {
    const match = revisedLine.match(/^\[(\d+)\] ?([^:\s][^:]*):(.+)$/);
    if (!match) {
      continue;
    }

    const index = Number.parseInt(match[1] ?? '', 10);
    const text = match[3]?.trim();
    if (Number.isNaN(index) || index < 0 || index >= updatedLines.length || !text) {
      continue;
    }

    const originalLine = updatedLines[index];
    if (!originalLine) {
      continue;
    }

    // Only update text, preserve all metadata (voiceId, speakerId, etc.)
    updatedLines[index] = { ...originalLine, text };
  }

  return { ...original, lines: updatedLines };
}

// ============================================================================
// TEXT CLEANING
// ============================================================================

/** Known ElevenLabs v3 audio tags that should NOT be stripped by cleanForAudio. */
const KNOWN_AUDIO_TAGS = new Set([
  'laughs',
  'sighs',
  'whispers',
  'pauses',
  'hesitates',
  'stammers',
  'excited',
  'curious',
  'sarcastic',
  'interrupting',
  'rushed',
  'slows down',
  'deliberate',
  'breathes',
  'gasps',
  'cheerfully',
  'flatly',
  'deadpan',
  'playfully',
  'mischievously',
  'calm',
  'happy',
  'angry',
  'nervous',
  'frustrated',
  'resigned tone',
  'speaking softly',
  'cuts in',
  'pause',
  'short pause',
  'long pause',
  'continues after a beat',
  'laughs harder',
  'starts laughing',
  'wheezing',
  'snorts',
  'crying',
  'exhales',
  'gulps',
  'drawn out',
  'rapid-fire',
  'shouts',
  'enthusiastic',
  'thoughtful',
  'confident',
  'passionate',
]);

/**
 * Clean message text for audio synthesis.
 * Removes markdown, code blocks, URLs, and other non-speakable content.
 */
function cleanForAudio(text: string): string {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`[^`]+`/g, '')
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Strip non-audio bracket content (preserve v3 audio tags)
    // Audio tags like [laughs], [sighs], [excited] are kept for ElevenLabs v3
    .replace(/\[([^\]]+)\]/g, (match, content: string) => KNOWN_AUDIO_TAGS.has(content.toLowerCase()) ? match : '')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove markdown bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Remove markdown underline
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Remove URLs
    .replace(/https?:\/\/\S+/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove bullet points / list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    // Remove numbered lists
    .replace(/^\s*\d+\.\s+/gm, '')
    // Collapse multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Collapse multiple spaces
    .replace(/ {2,}/g, ' ')
    .trim();
}
