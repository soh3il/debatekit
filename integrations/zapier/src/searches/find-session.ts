import type { Bundle, ZObject } from 'zapier-platform-core';
import { ApiSessionDetailSchema } from '../types';
import type { FindSessionInput } from '../types';
import { API_BASE } from '../constants';

const perform = async (
  z: ZObject,
  bundle: Bundle<FindSessionInput>
) => {
  const response = await z.request({
    url: `${API_BASE}/api/v1/sessions/${bundle.inputData.session_id}`,
  });

  if (response.status === 404) {
    return [];
  }

  const session = ApiSessionDetailSchema.parse(response.data);

  return [
    {
      id: session.id,
      tool_name: session.toolName,
      prompt: session.prompt,
      thinking_level: session.thinkingLevel,
      quality_score: session.qualityScore,
      total_credits: session.totalCredits,
      duration_ms: session.durationMs,
      created_at: session.createdAt,
      result_json: session.resultJson,
    },
  ];
};

export default {
  key: 'find_session',
  noun: 'Session',

  display: {
    label: 'Find a Session',
    description: 'Finds a DebateKit session by its ID.',
  },

  operation: {
    perform,

    inputFields: [
      {
        key: 'session_id',
        label: 'Session ID',
        type: 'string',
        required: true,
        helpText: 'The ID of the session to look up.',
      },
    ],

    sample: {
      id: 'abc12345-6789-0000-aaaa-bbbbccccdddd',
      tool_name: 'consult',
      prompt: 'What are the tradeoffs between REST and GraphQL?',
      thinking_level: 'medium',
      quality_score: 0.85,
      total_credits: 3,
      duration_ms: 12500,
      created_at: '2026-03-09T12:00:00.000Z',
      result_json: '{"participants":[...],"moderator":{...},"metadata":{...}}',
    },

    outputFields: [
      { key: 'id', label: 'Session ID', type: 'string' },
      { key: 'tool_name', label: 'Tool Name', type: 'string' },
      { key: 'prompt', label: 'Prompt', type: 'string' },
      { key: 'thinking_level', label: 'Thinking Level', type: 'string' },
      { key: 'quality_score', label: 'Quality Score', type: 'number' },
      { key: 'total_credits', label: 'Credits Used', type: 'number' },
      { key: 'duration_ms', label: 'Duration (ms)', type: 'number' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
      { key: 'result_json', label: 'Full Result (JSON)', type: 'string' },
    ],
  },
};
