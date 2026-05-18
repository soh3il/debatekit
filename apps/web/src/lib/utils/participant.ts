/**
 * Participant Utilities
 *
 * **CONSOLIDATED MODULE**: Single source of truth for all participant operations
 * Merged from participant-comparison.ts, participant-transformers.ts, participant-utils.ts
 *
 * Provides:
 * - Comparison and equality checks
 * - Format transformation
 * - Validation and deduplication
 * - Priority-based sorting (SINGLE SOURCE OF TRUTH)
 *
 * @module lib/utils/participant
 */

import type { ParticipantComparisonMode } from '@debatekit/shared';
import { ParticipantComparisonModes } from '@debatekit/shared';

import { MIN_PARTICIPANTS_REQUIRED } from '@/lib/config/participant-limits';
import type { ParticipantConfig } from '@/lib/schemas';
import type { ChatParticipant } from '@/services/api';
import { DEFAULT_PRESET_PARTICIPANTS } from '@/stores/chat/store-defaults';

// ============================================================================
// Priority Sorting (SINGLE SOURCE OF TRUTH)
// ============================================================================

/**
 * Type for any object with a priority field
 */
export type WithPriority = { priority: number };

/**
 * Sort participants by priority (ascending order)
 *
 * **SINGLE SOURCE OF TRUTH**: Use this function everywhere instead of inline sorting.
 * Eliminates 25+ duplicates of `[...arr].sort((a, b) => a.priority - b.priority)`
 *
 * @param participants - Array of objects with priority field
 * @returns New array sorted by priority (original unchanged)
 *
 * @example
 * ```typescript
 * // Instead of: [...participants].sort((a, b) => a.priority - b.priority)
 * const sorted = sortByPriority(participants);
 * ```
 */
export function sortByPriority<T extends WithPriority>(participants: T[]): T[] {
  return [...participants].sort((a, b) => a.priority - b.priority);
}

/**
 * Reindex participant priorities to be contiguous (0, 1, 2, ...)
 *
 * **SINGLE SOURCE OF TRUTH**: Use this function everywhere instead of inline mapping.
 * Eliminates 15+ duplicates of `.map((p, index) => ({ ...p, priority: index }))`
 *
 * @param participants - Array of participants to reindex
 * @returns New array with priority field updated to match array index
 *
 * @example
 * ```typescript
 * // Instead of: participants.map((p, index) => ({ ...p, priority: index }))
 * const reindexed = reindexParticipantPriorities(participants);
 * ```
 */
export function reindexParticipantPriorities<T extends WithPriority>(participants: T[]): T[] {
  return participants.map((p, index) => ({ ...p, priority: index }));
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Comparable participant type (common fields between ChatParticipant and ParticipantConfig)
 *
 * Note: Using explicit type rather than Pick<union> to correctly handle optional properties
 * Both ChatParticipant and ParticipantConfig have optional `role` field
 */
export type ComparableParticipant = {
  modelId: string;
  role?: string | null;
  priority: number;
  customRoleId?: string | null;
  isEnabled?: boolean;
};

/**
 * Update payload for participant changes
 */
export type UpdateParticipantPayload = {
  id: string;
  modelId: string;
  role: string | null;
  customRoleId: string | null | undefined;
  priority: number;
  isEnabled: boolean;
};

// ============================================================================
// Comparison Functions
// ============================================================================

/**
 * Generate comparison key for a participant
 *
 * @param participant - Participant to generate key for
 * @param mode - Comparison mode ('modelIds' | 'strict')
 * @returns Stable comparison key
 */
export function getParticipantKey(
  participant: ComparableParticipant,
  mode: ParticipantComparisonMode = ParticipantComparisonModes.STRICT,
): string {
  if (mode === ParticipantComparisonModes.MODEL_IDS) {
    return participant.modelId;
  }

  return `${participant.modelId}:${participant.priority}:${participant.role || 'null'}:${participant.customRoleId || 'null'}`;
}

/**
 * Generate sorted comparison key for participant array
 *
 * @param participants - Array of participants
 * @param mode - Comparison mode
 * @param filterEnabled - Filter out disabled participants
 * @returns Sorted, delimited comparison key
 */
export function getParticipantsKey(
  participants: ComparableParticipant[],
  mode: ParticipantComparisonMode = ParticipantComparisonModes.STRICT,
  filterEnabled = true,
): string {
  const filtered = filterEnabled
    ? participants.filter(p => p.isEnabled !== false)
    : participants;

  return sortByPriority(filtered)
    .map(p => getParticipantKey(p, mode))
    .join('|');
}

/**
 * Compare two participant arrays for equality
 *
 * @param a - First array
 * @param b - Second array
 * @param mode - Comparison mode
 * @param options - Additional options
 * @param options.filterEnabled - Whether to filter out disabled participants (default: true)
 * @returns True if equal
 */
export function compareParticipants(
  a: ComparableParticipant[],
  b: ComparableParticipant[],
  mode: ParticipantComparisonMode = ParticipantComparisonModes.STRICT,
  options?: { filterEnabled?: boolean },
): boolean {
  const { filterEnabled = true } = options || {};
  const keyA = getParticipantsKey(a, mode, filterEnabled);
  const keyB = getParticipantsKey(b, mode, filterEnabled);
  return keyA === keyB;
}

/**
 * Check if participant configuration changed
 *
 * @param current - Current participants
 * @param updated - Updated participants
 * @param mode - Comparison mode
 * @returns True if changed
 */
export function hasParticipantsChanged(
  current: ComparableParticipant[],
  updated: ComparableParticipant[],
  mode: ParticipantComparisonMode = ParticipantComparisonModes.STRICT,
): boolean {
  return !compareParticipants(current, updated, mode);
}

// ============================================================================
// Enabled Participant Utilities (SINGLE SOURCE OF TRUTH)
// Eliminates 30+ duplicate `.filter(p => p.isEnabled)` patterns
// ============================================================================

/**
 * Type for participants with optional isEnabled field
 */
export type WithEnabled = { isEnabled?: boolean | null };

/**
 * Filter to enabled participants only
 *
 * **SINGLE SOURCE OF TRUTH**: Use instead of `.filter(p => p.isEnabled)`
 * Handles both `isEnabled: true` and `isEnabled !== false` (for API compatibility)
 *
 * @param participants - Array of participants
 * @returns Only enabled participants
 *
 * @example
 * ```typescript
 * // Instead of: participants.filter(p => p.isEnabled)
 * const enabled = getEnabledParticipants(participants);
 * ```
 */
export function getEnabledParticipants<T extends WithEnabled>(
  participants: T[],
): T[] {
  return participants.filter(p => p.isEnabled !== false);
}

/**
 * Filter to enabled participants and sort by priority
 *
 * **SINGLE SOURCE OF TRUTH**: Combines the two most common operations.
 * Eliminates 20+ duplicates of `sortByPriority(participants.filter(p => p.isEnabled))`
 *
 * @param participants - Array of participants with priority and isEnabled
 * @returns Enabled participants sorted by priority
 *
 * @example
 * ```typescript
 * // Instead of: sortByPriority(participants.filter(p => p.isEnabled))
 * const enabledSorted = getEnabledSortedParticipants(participants);
 * ```
 */
export function getEnabledSortedParticipants<T extends WithEnabled & WithPriority>(
  participants: T[],
): T[] {
  return sortByPriority(participants.filter(p => p.isEnabled !== false));
}

/**
 * Extract model IDs from participants as array
 *
 * **SINGLE SOURCE OF TRUTH**: Use instead of `.map(p => p.modelId)`
 * Eliminates 20+ duplicate modelId extractions
 *
 * @param participants - Array of participants
 * @returns Array of model IDs (preserves order)
 *
 * @example
 * ```typescript
 * // Instead of: participants.map(p => p.modelId)
 * const modelIds = getParticipantModelIds(participants);
 * ```
 */
export function getParticipantModelIds<T extends { modelId: string }>(
  participants: T[],
): string[] {
  return participants.map(p => p.modelId);
}

/**
 * Extract model IDs from enabled participants
 *
 * **SINGLE SOURCE OF TRUTH**: Combined filter + map operation
 * Eliminates patterns like `participants.filter(p => p.isEnabled).map(p => p.modelId)`
 *
 * @param participants - Array of participants
 * @returns Array of model IDs from enabled participants only
 *
 * @example
 * ```typescript
 * // Instead of: participants.filter(p => p.isEnabled).map(p => p.modelId)
 * const enabledModelIds = getEnabledParticipantModelIds(participants);
 * ```
 */
export function getEnabledParticipantModelIds<T extends WithEnabled & { modelId: string }>(
  participants: T[],
): string[] {
  return participants
    .filter(p => p.isEnabled !== false)
    .map(p => p.modelId);
}

/**
 * Create a Set of model IDs from enabled participants
 *
 * **SINGLE SOURCE OF TRUTH**: For O(1) membership checks
 * Eliminates: `new Set(participants.filter(p => p.isEnabled).map(p => p.modelId))`
 *
 * @param participants - Array of participants
 * @returns Set of model IDs for fast lookup
 *
 * @example
 * ```typescript
 * // Instead of: new Set(enabledParticipants.map(p => p.modelId))
 * const modelIdSet = getEnabledParticipantModelIdSet(participants);
 * if (modelIdSet.has(someModelId)) { ... }
 * ```
 */
export function getEnabledParticipantModelIdSet<T extends WithEnabled & { modelId: string }>(
  participants: T[],
): Set<string> {
  return new Set(getEnabledParticipantModelIds(participants));
}

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Transform ParticipantConfig to API update payload
 *
 * @param participant - Participant configuration from form
 * @returns API update payload
 */
export function participantConfigToUpdatePayload(
  participant: ParticipantConfig,
): UpdateParticipantPayload {
  // ✅ FIX: Detect if this is a new participant (id === modelId) vs existing (id is ULID)
  // - New participants use modelId as their ID (e.g., 'openai/gpt-4')
  // - Existing participants have database-assigned IDs (ULIDs)
  // - Backend uses empty string to trigger "find by modelId" logic for new participants
  const isNewParticipant = participant.id === participant.modelId;
  return {
    customRoleId: participant.customRoleId || null,
    id: isNewParticipant ? '' : participant.id,
    isEnabled: true,
    modelId: participant.modelId,
    priority: participant.priority,
    role: participant.role || null,
  };
}

/**
 * Transform ParticipantConfig to optimistic ChatParticipant
 *
 * @param participant - Participant configuration
 * @param threadId - Thread ID
 * @param index - Priority index
 * @returns Complete ChatParticipant for optimistic update
 */
export function participantConfigToOptimistic(
  participant: ParticipantConfig,
  threadId: string,
  index: number,
): ChatParticipant {
  const now = new Date();

  return {
    createdAt: now.toISOString(),
    customRoleId: participant.customRoleId || null,
    id: participant.id,
    isEnabled: true,
    modelId: participant.modelId,
    priority: index,
    role: participant.role || null,
    settings: participant.settings || null,
    threadId,
    updatedAt: now.toISOString(),
  };
}

/**
 * Convert ChatParticipant array to ParticipantConfig array
 *
 * Used to sync selectedParticipants (form state) from participants (DB state)
 * after thread creation or update.
 *
 * @param participants - Database participants to convert
 * @returns ParticipantConfig array for form state
 *
 * @example
 * ```typescript
 * const participantConfigs = chatParticipantsToConfig(dbParticipants);
 * actions.setSelectedParticipants(participantConfigs);
 * ```
 */
export function chatParticipantsToConfig(
  participants: ChatParticipant[],
): ParticipantConfig[] {
  return getEnabledSortedParticipants(participants)
    .map((p, index) => ({
      customRoleId: p.customRoleId || undefined,
      id: p.id,
      modelId: p.modelId,
      priority: index,
      role: p.role,
    }));
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if participant already exists in list
 *
 * @param participants - Existing participants
 * @param modelId - Model ID to check
 * @returns True if duplicate
 */
export function isParticipantDuplicate(
  participants: Pick<ChatParticipant | ParticipantConfig, 'modelId'>[],
  modelId: string,
): boolean {
  return participants.some(p => p.modelId === modelId);
}

/**
 * Get next priority for new participant
 *
 * @param participants - Existing participants
 * @returns Next priority number
 */
export function getNextParticipantPriority(
  participants: Pick<ChatParticipant | ParticipantConfig, 'priority'>[],
): number {
  if (participants.length === 0) {
    return 0;
  }

  const maxPriority = Math.max(...participants.map(p => p.priority));
  return maxPriority + 1;
}

/**
 * Deduplicate participants by modelId
 *
 * When duplicates found, keeps participant with lower priority.
 *
 * @param participants - Array to deduplicate
 * @returns Deduplicated and sorted array
 */
export function deduplicateParticipants<T extends { modelId: string; priority: number }>(
  participants: T[],
): T[] {
  const modelMap = new Map<string, T>();

  // Sort by priority for deterministic selection
  sortByPriority(participants).forEach((p) => {
    if (!modelMap.has(p.modelId)) {
      modelMap.set(p.modelId, p);
    }
  });

  return sortByPriority(Array.from(modelMap.values()));
}

// ============================================================================
// Manual Mode Participant Resolution
// ============================================================================

type ManualModeFallbackSource = {
  modelId: string;
  role?: string | null;
};

type ResolveManualModeOptions = {
  accessibleModelIds: string[];
  currentParticipants: ParticipantConfig[];
  /**
   * Primary fallback: thread participants (ChatView) or initial participants
   * (overview/project screens).
   */
  fallbackParticipants: ManualModeFallbackSource[];
  incompatibleModelIds: Set<string>;
};

/**
 * Resolves participant list when switching from auto to manual mode.
 *
 * Priority chain:
 * 1. Current participants (filtered for compatibility)
 * 2. Fallback participants (filtered for compatibility)
 * 3. First N accessible + compatible models
 * 4. Whatever fallback participants exist (unfiltered)
 * 5. DEFAULT_PRESET_PARTICIPANTS (compile-time constant)
 */
export function resolveManualModeParticipants({
  accessibleModelIds,
  currentParticipants,
  fallbackParticipants,
  incompatibleModelIds,
}: ResolveManualModeOptions): ParticipantConfig[] {
  // Priority 1: current participants, filtered for compatibility
  const compatibleCurrent = incompatibleModelIds.size > 0
    ? currentParticipants.filter(p => !incompatibleModelIds.has(p.modelId))
    : currentParticipants;

  if (compatibleCurrent.length >= MIN_PARTICIPANTS_REQUIRED) {
    return compatibleCurrent.map((p, i) => ({ ...p, priority: i }));
  }

  // Priority 2: fallback participants, filtered for compatibility
  if (fallbackParticipants.length >= MIN_PARTICIPANTS_REQUIRED) {
    const compatible = incompatibleModelIds.size > 0
      ? fallbackParticipants.filter(p => !incompatibleModelIds.has(p.modelId))
      : fallbackParticipants;
    if (compatible.length >= MIN_PARTICIPANTS_REQUIRED) {
      return compatible.map((p, i) => ({
        id: p.modelId,
        modelId: p.modelId,
        priority: i,
        role: p.role ?? '',
      }));
    }
  }

  // Priority 3: first N accessible + compatible models
  const compatibleAccessible = accessibleModelIds.filter(id => !incompatibleModelIds.has(id));
  if (compatibleAccessible.length >= MIN_PARTICIPANTS_REQUIRED) {
    return compatibleAccessible.slice(0, MIN_PARTICIPANTS_REQUIRED).map((modelId, i) => ({
      id: modelId,
      modelId,
      priority: i,
      role: '',
    }));
  }

  // Priority 4: fallback participants as-is (even if below minimum)
  if (fallbackParticipants.length > 0) {
    return fallbackParticipants.map((p, i) => ({
      id: p.modelId,
      modelId: p.modelId,
      priority: i,
      role: p.role ?? '',
    }));
  }

  // Priority 5: compile-time constant
  return DEFAULT_PRESET_PARTICIPANTS;
}

// ============================================================================
// Preset Participant Supplementation
// ============================================================================

type SupplementOptions = {
  /**
   * Model IDs to draw supplements from. Should already be filtered
   * for accessibility (is_accessible_to_user).
   */
  accessibleModelIds: string[];
  incompatibleModelIds: Set<string>;
  participants: ParticipantConfig[];
};

/**
 * Supplements a preset's filtered participants when they drop below minimum.
 * Adds accessible, compatible models that aren't already in the preset.
 */
export function supplementPresetParticipants({
  accessibleModelIds,
  incompatibleModelIds,
  participants,
}: SupplementOptions): ParticipantConfig[] {
  if (participants.length === 0 || participants.length >= MIN_PARTICIPANTS_REQUIRED) {
    return participants;
  }

  const existing = new Set(participants.map(p => p.modelId));
  const supplement = accessibleModelIds
    .filter(id => !existing.has(id) && !incompatibleModelIds.has(id))
    .slice(0, MIN_PARTICIPANTS_REQUIRED - participants.length);

  if (supplement.length === 0) {
    return participants;
  }

  return [
    ...participants,
    ...supplement.map((modelId, index) => ({
      id: modelId,
      modelId,
      priority: participants.length + index,
      role: '',
    })),
  ];
}

// ============================================================================
// Update Detection & Preparation
// ============================================================================
// Extracted from participant-updates.ts for consolidation

/**
 * Result of participant change detection
 */
export type ParticipantUpdateResult = {
  /** Whether any changes were detected */
  hasChanges: boolean;
  /** Whether any participants have temporary IDs (not yet persisted) */
  hasTemporaryIds: boolean;
  /** Whether participant list or configuration changed */
  participantsChanged: boolean;
};

/**
 * Prepared data for participant update
 */
export type PreparedParticipantUpdate = {
  /** Update result with change flags */
  updateResult: ParticipantUpdateResult;
  /** Payloads for API PATCH request */
  updatePayloads: UpdateParticipantPayload[];
  /** Optimistic participant data for immediate UI update */
  optimisticParticipants: ChatParticipant[];
};

/**
 * Detect if participant configuration has changed
 *
 * Compares current participants with selected participants to determine
 * if an API update is needed. Checks for:
 * - Temporary IDs (new participants not yet persisted)
 * - Participant list changes (additions/removals)
 * - Configuration changes (priority, role, modelId)
 *
 * @param currentParticipants - Current persisted participants
 * @param selectedParticipants - New participant configuration from form
 * @returns Change detection result
 *
 * @example
 * const result = detectParticipantChanges(
 *   thread.participants,
 *   formState.selectedParticipants
 * )
 *
 * if (result.hasChanges) {
 *   // Trigger update
 * }
 */
export function detectParticipantChanges(
  currentParticipants: ChatParticipant[],
  selectedParticipants: ParticipantConfig[],
): ParticipantUpdateResult {
  // ✅ FIX: Detect new participants by checking if id === modelId (not persisted yet)
  // New participants use modelId as their ID, existing use database-assigned ULIDs
  const hasTemporaryIds = selectedParticipants.some(p =>
    p.id === p.modelId,
  );

  // Compare participant configurations using strict mode
  // Strict mode compares: modelId, priority, role, customRoleId
  const participantsChanged = hasParticipantsChanged(
    currentParticipants,
    selectedParticipants,
    ParticipantComparisonModes.STRICT,
  );

  const hasChanges = hasTemporaryIds || participantsChanged;

  return {
    hasChanges,
    hasTemporaryIds,
    participantsChanged,
  };
}

/**
 * Determine if participant config update should be triggered
 *
 * @param updateResult - Result from detectParticipantChanges
 * @returns True if update should be executed
 */
export function shouldUpdateParticipantConfig(
  updateResult: ParticipantUpdateResult,
): boolean {
  return updateResult.hasChanges;
}

/**
 * Prepare all data needed for participant update
 *
 * Generates:
 * - Change detection flags
 * - API update payloads (temporary IDs converted to empty strings)
 * - Optimistic participant data for immediate UI update
 *
 * IMPORTANT: This function merges database IDs from currentParticipants into
 * selectedParticipants by matching on modelId. This ensures that existing
 * participants retain their database IDs in the PATCH payload, while truly
 * new participants get empty string IDs (triggering backend "find by modelId" logic).
 *
 * @param currentParticipants - Current persisted participants (source of truth for IDs)
 * @param selectedParticipants - New participant configuration
 * @param threadId - Thread ID for optimistic participants
 * @returns Prepared update data ready for mutation
 *
 * @example
 * const prepared = prepareParticipantUpdate(
 *   threadState.participants,
 *   formState.selectedParticipants,
 *   threadId
 * )
 *
 * if (shouldUpdateParticipantConfig(prepared.updateResult)) {
 *   await updateThreadMutation.mutateAsync({
 *     json: { participants: prepared.updatePayloads }
 *   })
 *   store.updateParticipants(prepared.optimisticParticipants)
 * }
 */
export function prepareParticipantUpdate(
  currentParticipants: ChatParticipant[],
  selectedParticipants: ParticipantConfig[],
  threadId: string,
): PreparedParticipantUpdate {
  // Detect changes
  const updateResult = detectParticipantChanges(
    currentParticipants,
    selectedParticipants,
  );

  // ✅ FIX: Build lookup map of database IDs by modelId from currentParticipants
  // This allows us to merge the correct database IDs into selectedParticipants
  // which may have id === modelId (from auto-mode or other sources without DB IDs)
  const dbIdsByModelId = new Map<string, string>();
  for (const participant of currentParticipants) {
    dbIdsByModelId.set(participant.modelId, participant.id);
  }

  // ✅ FIX: Merge database IDs into selectedParticipants before creating payloads
  // If a participant with the same modelId exists in currentParticipants, use its database ID
  // Otherwise, keep the original ID (will be handled as new participant by participantConfigToUpdatePayload)
  const participantsWithDbIds = selectedParticipants.map((p) => {
    const existingId = dbIdsByModelId.get(p.modelId);
    if (existingId && p.id === p.modelId) {
      // This participant exists in DB but selectedParticipants has id === modelId
      // Replace with the actual database ID
      return { ...p, id: existingId };
    }
    return p;
  });

  // Prepare update payloads for API using merged IDs
  const updatePayloads = participantsWithDbIds.map(p =>
    participantConfigToUpdatePayload(p),
  );

  // Prepare optimistic participant data using merged IDs
  const optimisticParticipants = participantsWithDbIds.map((p, index) =>
    participantConfigToOptimistic(p, threadId, index),
  );

  return {
    optimisticParticipants,
    updatePayloads,
    updateResult,
  };
}
