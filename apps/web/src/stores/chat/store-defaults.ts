/**
 * Minimal Chat Store Defaults - Complete Rewrite
 *
 * Single source of truth for all default values.
 */

import type { ParticipantConfig } from '@debatekit/shared';
import { ChatModes, ModelIds, ScreenModes } from '@debatekit/shared';

import type {
  AttachmentsState,
  ChangelogState,
  FormState,
  ParticipantSnapshotEntry,
  PreSearchState,
  ThreadState,
  TitleAnimationState,
  TrackingState,
  UIState,
} from './store-schemas';
import { ChatPhases } from './store-schemas';

// ============================================================================
// DEFAULT PRESET CONFIG
// ============================================================================

export const DEFAULT_PRESET_MODE = ChatModes.ANALYZING;

export const DEFAULT_PRESET_PARTICIPANTS = [
  { id: ModelIds.OPENAI_GPT_4O_MINI, modelId: ModelIds.OPENAI_GPT_4O_MINI, priority: 0, role: 'Analyst' },
  { id: ModelIds.X_AI_GROK_4_FAST, modelId: ModelIds.X_AI_GROK_4_FAST, priority: 1, role: 'Challenger' },
  { id: ModelIds.DEEPSEEK_DEEPSEEK_V3_2, modelId: ModelIds.DEEPSEEK_DEEPSEEK_V3_2, priority: 2, role: 'Synthesizer' },
] satisfies ParticipantConfig[];

// ============================================================================
// SLICE DEFAULTS
// ============================================================================

export const THREAD_DEFAULTS: ThreadState = {
  activeRoundParticipantCount: 0,
  completedParticipantCount: 0,
  currentParticipantIndex: 0,
  currentRoundNumber: null,
  hasSentPendingMessage: false,
  isRegenerating: false,
  participants: [],
  participantSnapshotsByRound: new Map<number, ParticipantSnapshotEntry[]>(),
  phase: ChatPhases.IDLE,
  regeneratingRoundNumber: null,
  streamingThreadId: null,
  thread: null,
};

export const FORM_DEFAULTS: FormState = {
  activePresetId: undefined,
  autoMode: true,
  dataSources: undefined,
  enableWebSearch: false,
  inputValue: '',
  modelOrder: [],
  moderatorFormat: undefined,
  pendingMessage: null,
  selectedMode: DEFAULT_PRESET_MODE,
  selectedParticipants: DEFAULT_PRESET_PARTICIPANTS,
};

export const UI_DEFAULTS: UIState = {
  createdThreadId: null,
  createdThreadProjectId: null,
  hasInitiallyLoaded: false,
  isAnalyzingPrompt: false,
  isCreatingThread: false,
  isResumeInProgress: false,
  screenMode: ScreenModes.OVERVIEW,
  showInitialUI: true,
};

export const ATTACHMENTS_DEFAULTS: AttachmentsState = {
  pendingAttachmentIds: null,
  pendingAttachments: [],
  pendingFileParts: null,
};

export const PRESEARCH_DEFAULTS: PreSearchState = {
  domainSourceProgress: [],
  preSearches: [],
};

export const CHANGELOG_DEFAULTS: ChangelogState = {
  changelogItems: [],
};

export const TITLE_ANIMATION_DEFAULTS: TitleAnimationState = {
  animatingThreadId: null,
  animationPhase: 'idle',
  displayedTitle: null,
  newTitle: null,
  oldTitle: null,
};

export const TRACKING_DEFAULTS: TrackingState = {
  preSearchActivityTimes: new Map<number, number>(),
  triggeredModeratorIds: new Set<string>(),
  triggeredModeratorRounds: new Set<number>(),
  triggeredPreSearchRounds: new Set<number>(),
};

// ============================================================================
// COMPLETE STORE DEFAULT
// ============================================================================

export const STORE_DEFAULTS = {
  ...THREAD_DEFAULTS,
  ...FORM_DEFAULTS,
  ...UI_DEFAULTS,
  ...ATTACHMENTS_DEFAULTS,
  ...PRESEARCH_DEFAULTS,
  ...CHANGELOG_DEFAULTS,
  ...TITLE_ANIMATION_DEFAULTS,
  ...TRACKING_DEFAULTS,
};

// ============================================================================
// RESET STATES
// ============================================================================

/** Reset for thread navigation (between threads) */
export const THREAD_NAVIGATION_RESET = {
  ...THREAD_DEFAULTS,
  ...TITLE_ANIMATION_DEFAULTS,
  // Explicit streaming field resets (also in THREAD_DEFAULTS, listed for clarity)
  activeRoundParticipantCount: 0,
  changelogItems: [],
  completedParticipantCount: 0,
  createdThreadId: null,
  createdThreadProjectId: null,
  currentParticipantIndex: 0,
  domainSourceProgress: [],
  hasInitiallyLoaded: false,
  // FIX: Reset transient form state to prevent input/pending message leaking between threads.
  // selectedParticipants, selectedMode, enableWebSearch, and autoMode are NOT reset here
  // because useSyncHydrateStore syncs them from thread data.
  inputValue: '',
  // BUG-8 FIX: Reset attachment state to prevent leaking between threads.
  isAnalyzingPrompt: false,
  isCreatingThread: false,
  isResumeInProgress: false,
  participantSnapshotsByRound: new Map<number, ParticipantSnapshotEntry[]>(),
  pendingAttachmentIds: null,
  pendingAttachments: [],
  pendingFileParts: null,
  pendingMessage: null,
  preSearchActivityTimes: new Map<number, number>(),
  preSearches: [],
  // FIX: Thread navigation should default to THREAD mode, not OVERVIEW.
  screenMode: ScreenModes.THREAD,
  triggeredModeratorIds: new Set<string>(),
  triggeredModeratorRounds: new Set<number>(),
  triggeredPreSearchRounds: new Set<number>(),
};

/** Reset for returning to overview */
export const OVERVIEW_RESET = {
  ...STORE_DEFAULTS,
  preSearchActivityTimes: new Map<number, number>(),
  triggeredModeratorIds: new Set<string>(),
  triggeredModeratorRounds: new Set<number>(),
  triggeredPreSearchRounds: new Set<number>(),
};

/**
 * Streaming complete reset.
 * Phase transition resets -- AI SDK manages message state.
 */
export const STREAMING_COMPLETE_RESET = {
  currentParticipantIndex: 0,
};

// ============================================================================
// AUTO MODE FALLBACK CONFIG
// ============================================================================

/** Fallback config when auto mode analysis fails */
export const AUTO_MODE_FALLBACK_CONFIG = {
  enableWebSearch: false,
  mode: DEFAULT_PRESET_MODE,
  participants: DEFAULT_PRESET_PARTICIPANTS,
};
