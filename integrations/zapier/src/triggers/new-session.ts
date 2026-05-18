import type { Bundle, ZObject } from 'zapier-platform-core';
import { SessionsListResponseSchema } from '../types';
import { API_BASE } from '../constants';

const perform = async (z: ZObject, _bundle: Bundle) => {
  const response = await z.request({
    url: `${API_BASE}/api/v1/sessions`,
    params: { limit: 10 },
  });

  const data = SessionsListResponseSchema.parse(response.data);
  const sessions = data.sessions;

  return sessions.map(session => ({
    id: session.id,
    tool_name: session.toolName,
    prompt: session.prompt,
    thinking_level: session.thinkingLevel,
    credits: session.totalCredits,
    duration_ms: session.durationMs,
    created_at: session.createdAt,
  }));
};

export default {
  key: 'new_session',
  noun: 'Session',

  display: {
    label: 'New DebateKit Session Created',
    description: 'Triggers when a new DebateKit session is created.',
  },

  operation: {
    perform,

    sample: {
      id: 'abc12345-6789-0000-aaaa-bbbbccccdddd',
      tool_name: 'consult',
      prompt: 'What are the tradeoffs between REST and GraphQL?',
      thinking_level: 'medium',
      credits: 3,
      duration_ms: 12500,
      created_at: '2026-03-09T12:00:00.000Z',
    },

    outputFields: [
      { key: 'id', label: 'Session ID', type: 'string' },
      { key: 'tool_name', label: 'Tool Name', type: 'string' },
      { key: 'prompt', label: 'Prompt', type: 'string' },
      { key: 'thinking_level', label: 'Thinking Level', type: 'string' },
      { key: 'credits', label: 'Credits Used', type: 'number' },
      { key: 'duration_ms', label: 'Duration (ms)', type: 'number' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
    ],
  },
};
