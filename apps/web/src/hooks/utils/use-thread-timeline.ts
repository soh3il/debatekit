import { MessageRoles } from '@debatekit/shared';
import type { UIMessage } from 'ai';
import { useMemo, useRef } from 'react';

import { getParticipantIndex, getRoundNumberFromMetadata, isModeratorMessage } from '@/lib/utils';
import type { ApiChangelog, StoredPreSearch } from '@/services/api';

/**
 * Timeline Item Types
 * Discriminated union for type-safe timeline rendering
 *
 * ARCHITECTURE:
 * - 'messages': All messages for a round (user, participants, moderator)
 *   Moderator messages (isModerator: true) are sorted LAST after all participants
 * - 'changelog': Configuration changes that occurred before round started
 * - 'pre-search': Web search phase indicator (orphaned rounds only)
 */
export type TimelineItem
  = | {
    type: 'messages';
    data: UIMessage[];
    key: string;
    roundNumber: number;
  }
  | {
    type: 'changelog';
    data: ApiChangelog[];
    key: string;
    roundNumber: number;
  }
  | {
    type: 'pre-search';
    data: StoredPreSearch;
    key: string;
    roundNumber: number;
  };

export type UseThreadTimelineOptions = {
  /**
   * Messages to group by round
   * Includes ALL message types: user, participants, and moderator
   * Moderator messages (isModerator: true) are sorted LAST in each round
   */
  messages: UIMessage[];

  /**
   * Changelog items to group by round
   * Accepts both Date and string for createdAt to match API JSON responses
   */
  changelog: ApiChangelog[];

  /**
   * Pre-searches to include in timeline
   * Required for rendering pre-search cards when user message
   * hasn't been persisted yet (e.g., page refresh during web search phase)
   */
  preSearches?: StoredPreSearch[];
};

/**
 * useThreadTimeline - Unified Timeline Grouping Hook
 *
 * Single source of truth for grouping messages, changelog, and pre-searches by round number.
 *
 * ARCHITECTURE:
 * - Messages array includes ALL messages: user, participants, AND moderator
 * - Moderator messages (isModerator: true) are sorted LAST after all participants
 * - Moderator renders inline via ChatMessageList, just like participants
 *
 * FLOW:
 * 1. Group messages by round number (from metadata)
 * 2. Sort messages: user first, then participants by index, then moderator LAST
 * 3. Group changelog by round number
 * 4. Index pre-searches by round number
 * 5. For each round, assemble timeline items in order:
 *    a. Changelog (configuration changes before messages)
 *    b. Pre-search (orphaned rounds only - otherwise rendered by ChatMessageList)
 *    c. Messages (user + participants + moderator, with moderator LAST)
 *
 * @example
 * ```tsx
 * const timeline = useThreadTimeline({
 *   messages,      // Includes moderator messages (isModerator: true)
 *   changelog,
 *   preSearches,
 * });
 *
 * return timeline.map((item) => {
 *   if (item.type === 'messages') {
 *     // Renders ALL messages including moderator (sorted LAST)
 *     return <ChatMessageList messages={item.data} />;
 *   }
 *   if (item.type === 'changelog') return <ChangelogGroup changes={item.data} />;
 *   if (item.type === 'pre-search') return <PreSearchCard data={item.data} />;
 * });
 * ```
 */
export function useThreadTimeline({
  changelog,
  messages,
  preSearches = [],
}: UseThreadTimelineOptions): TimelineItem[] {
  // ✅ PERF: Structural fingerprint to skip full recomputation during streaming.
  // Timeline structure only changes when messages are added/removed (IDs change)
  // or changelog/preSearches change. During streaming, only text content changes
  // but IDs stay the same — so we skip the O(n) grouping + sorting.
  const messageFingerprint = useMemo(() => {
    return messages.map(m => m.id).join('|');
  }, [messages]);

  const changelogFingerprint = useMemo(() => {
    return changelog.map(c => c.id).join('|');
  }, [changelog]);

  const preSearchFingerprint = useMemo(() => {
    return preSearches.map(p =>
      `${p.roundNumber}:${p.status}:q${p.searchData?.queries?.length ?? 0}:r${p.searchData?.results?.length ?? 0}`,
    ).join('|');
  }, [preSearches]);

  const lastTimelineRef = useRef<{
    changelogFp: string;
    messageFp: string;
    preSearchFp: string;
    result: TimelineItem[];
  }>({
    changelogFp: '',
    messageFp: '',
    preSearchFp: '',
    result: [],
  });

  // ✅ PERF: Reuse Map allocation across fast-path renders to reduce GC pressure
  const msgByIdRef = useRef(new Map<string, UIMessage>());

  return useMemo(() => {
    const cached = lastTimelineRef.current;

    // ✅ FAST PATH: If structure hasn't changed, update message references only.
    // During streaming, only text content changes but message IDs stay the same.
    // This avoids O(n) grouping + O(k log k) sorting on every streaming chunk (~30x/sec).
    if (
      cached.result.length > 0
      && cached.messageFp === messageFingerprint
      && cached.changelogFp === changelogFingerprint
      && cached.preSearchFp === preSearchFingerprint
    ) {
      // ✅ PERF: Reuse cached Map, just update values (avoids new Map allocation per flush)
      const msgById = msgByIdRef.current;
      for (const m of messages) {
        msgById.set(m.id, m);
      }
      // Build presearch lookup for fast-path updates
      const psByRound = new Map<number, StoredPreSearch>();
      for (const ps of preSearches) {
        psByRound.set(ps.roundNumber, ps);
      }
      // Update message AND presearch data references with fresh values
      const updated = cached.result.map((item) => {
        if (item.type === 'messages') {
          return {
            ...item,
            data: item.data.map(m => msgById.get(m.id) ?? m),
          };
        }
        if (item.type === 'pre-search') {
          const fresh = psByRound.get(item.roundNumber);
          return fresh ? { ...item, data: fresh } : item;
        }
        return item;
      });
      lastTimelineRef.current.result = updated;
      return updated;
    }

    // FULL RECOMPUTATION: Structure changed (messages added/removed, changelog changed)
    // Clear cached Map to prevent stale entries from previous message sets
    msgByIdRef.current.clear();

    // STEP 1: Group messages by round number
    const messagesByRound = new Map<number, UIMessage[]>();
    messages.forEach((message) => {
      const roundNumber = getRoundNumberFromMetadata(message.metadata, 0);

      if (!messagesByRound.has(roundNumber)) {
        messagesByRound.set(roundNumber, []);
      }
      const roundMessages = messagesByRound.get(roundNumber);
      if (roundMessages) {
        roundMessages.push(message);
      }
    });

    // STEP 2: Sort messages within each round
    // Order: user → participants (by index) → moderator LAST
    messagesByRound.forEach((roundMessages, _roundNumber) => {
      roundMessages.sort((a, b) => {
        if (a.role === MessageRoles.USER && b.role !== MessageRoles.USER) {
          return -1;
        }
        if (a.role !== MessageRoles.USER && b.role === MessageRoles.USER) {
          return 1;
        }

        if (a.role === MessageRoles.ASSISTANT && b.role === MessageRoles.ASSISTANT) {
          const aIsModerator = isModeratorMessage(a);
          const bIsModerator = isModeratorMessage(b);

          if (aIsModerator && !bIsModerator) {
            return 1;
          }
          if (!aIsModerator && bIsModerator) {
            return -1;
          }

          const indexA = getParticipantIndex(a.metadata) ?? 0;
          const indexB = getParticipantIndex(b.metadata) ?? 0;
          return indexA - indexB;
        }

        return 0;
      });
    });

    // STEP 3: Group changelog by round number
    const changelogByRound = new Map<number, ApiChangelog[]>();
    changelog.forEach((change) => {
      const roundNumber = change.roundNumber ?? 0;

      if (!changelogByRound.has(roundNumber)) {
        changelogByRound.set(roundNumber, []);
      }

      const roundChanges = changelogByRound.get(roundNumber);
      if (roundChanges) {
        const exists = roundChanges.some(existing => existing.id === change.id);
        if (!exists) {
          roundChanges.push(change);
        }
      }
    });

    // STEP 4: Index pre-searches by round number
    const preSearchByRound = new Map<number, StoredPreSearch>();
    preSearches.forEach((preSearch) => {
      preSearchByRound.set(preSearch.roundNumber, preSearch);
    });

    // STEP 5: Collect all unique round numbers
    const allRoundNumbers = new Set<number>([
      ...messagesByRound.keys(),
      ...changelogByRound.keys(),
      ...preSearchByRound.keys(),
    ]);

    // STEP 6: Build timeline items in chronological order
    const timeline: TimelineItem[] = [];
    const sortedRounds = Array.from(allRoundNumbers).sort((a, b) => a - b);

    sortedRounds.forEach((roundNumber) => {
      const roundMessages = messagesByRound.get(roundNumber);
      const roundChangelog = changelogByRound.get(roundNumber);
      const roundPreSearch = preSearchByRound.get(roundNumber);

      const hasMessages = roundMessages && roundMessages.length > 0;
      const hasPreSearch = !!roundPreSearch;
      const hasChangelog = roundChangelog && roundChangelog.length > 0;

      if (!hasMessages && !hasPreSearch) {
        return;
      }

      if (hasChangelog) {
        timeline.push({
          data: roundChangelog,
          key: `round-${roundNumber}-changelog`,
          roundNumber,
          type: 'changelog',
        });
      }

      if (hasPreSearch && !hasMessages) {
        timeline.push({
          data: roundPreSearch,
          key: `round-${roundNumber}-pre-search`,
          roundNumber,
          type: 'pre-search',
        });
      }

      if (hasMessages) {
        timeline.push({
          data: roundMessages,
          key: `round-${roundNumber}-messages`,
          roundNumber,
          type: 'messages',
        });
      }
    });

    // Cache the result with fingerprints
    lastTimelineRef.current = {
      changelogFp: changelogFingerprint,
      messageFp: messageFingerprint,
      preSearchFp: preSearchFingerprint,
      result: timeline,
    };

    return timeline;
  }, [messages, changelog, preSearches, messageFingerprint, changelogFingerprint, preSearchFingerprint]);
}
