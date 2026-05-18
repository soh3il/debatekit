import { MessageRoles } from '@debatekit/shared';
import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';

import {
  getModeratorStreamingId,
  getParticipantStreamingId,
  hasStreamingPlaceholders,
  isPlaceholderId,
} from '../streaming-helpers';

describe('streaming-helpers', () => {
  describe('getParticipantStreamingId', () => {
    it('generates correct ID format', () => {
      expect(getParticipantStreamingId(0, 0)).toBe('streaming_p0_r0');
      expect(getParticipantStreamingId(1, 2)).toBe('streaming_p1_r2');
      expect(getParticipantStreamingId(5, 10)).toBe('streaming_p5_r10');
    });
  });

  describe('getModeratorStreamingId', () => {
    it('uses threadId when available', () => {
      expect(getModeratorStreamingId('thread123', 0)).toBe('thread123_r0_moderator');
      expect(getModeratorStreamingId('abc', 5)).toBe('abc_r5_moderator');
    });

    it('falls back to streaming prefix when no threadId', () => {
      expect(getModeratorStreamingId(null, 0)).toBe('streaming_moderator_r0');
      expect(getModeratorStreamingId(null, 3)).toBe('streaming_moderator_r3');
    });
  });

  describe('isPlaceholderId', () => {
    it('identifies streaming placeholder IDs with streaming_ prefix', () => {
      expect(isPlaceholderId('streaming_p0_r0')).toBe(true);
      expect(isPlaceholderId('streaming_moderator_r0')).toBe(true);
      expect(isPlaceholderId('streaming_anything')).toBe(true);
    });

    it('identifies moderator placeholder IDs with _moderator suffix', () => {
      // Moderator IDs with threadId use {threadId}_r{round}_moderator format
      expect(isPlaceholderId('thread123_r0_moderator')).toBe(true);
      expect(isPlaceholderId('abc_r5_moderator')).toBe(true);
    });

    it('identifies non-placeholder IDs', () => {
      expect(isPlaceholderId('thread123_r0_p0')).toBe(false);
      expect(isPlaceholderId('regular-id')).toBe(false);
      expect(isPlaceholderId('some-other-message')).toBe(false);
    });
  });

  describe('hasStreamingPlaceholders', () => {
    it('detects placeholder IDs', () => {
      const messages: UIMessage[] = [
        { id: 'streaming_p0_r0', parts: [], role: MessageRoles.ASSISTANT },
      ];
      expect(hasStreamingPlaceholders(messages)).toBe(true);
    });

    it('detects streaming metadata', () => {
      const messages: UIMessage[] = [
        {
          id: 'real-id',
          metadata: { isStreaming: true },
          parts: [],
          role: MessageRoles.ASSISTANT,
        },
      ];
      expect(hasStreamingPlaceholders(messages)).toBe(true);
    });

    it('returns false for non-streaming messages', () => {
      const messages: UIMessage[] = [
        {
          id: 'thread123_r0_p0',
          metadata: { isStreaming: false },
          parts: [],
          role: MessageRoles.ASSISTANT,
        },
      ];
      expect(hasStreamingPlaceholders(messages)).toBe(false);
    });
  });
});
