import type { Bundle, ZObject } from 'zapier-platform-core';
import { CHAT_MODE_VALUES } from '../shared-constants';
import type { StartDebateKitInput, ConsultRequestBody } from '../types';
import { API_BASE } from '../constants';
import {
  parseConsultResponse,
  mapBaseResult,
  THINKING_LEVEL_INPUT_FIELD,
} from '../helpers';

const mapParticipant = (p: { model_id: string; model_name: string; role: string | null; response: string }) => ({
  model_id: p.model_id,
  model_name: p.model_name,
  role: p.role,
  response: p.response,
});

const perform = async (
  z: ZObject,
  bundle: Bundle<StartDebateKitInput>
) => {
  const body: ConsultRequestBody = {
    prompt: bundle.inputData.prompt,
  };

  if (bundle.inputData.thinking_level) {
    body.thinking_level = bundle.inputData.thinking_level;
  }

  if (bundle.inputData.mode) {
    body.mode = bundle.inputData.mode;
  }

  if (bundle.inputData.context) {
    body.context = bundle.inputData.context;
  }

  const response = await z.request({
    url: `${API_BASE}/api/v1/consult`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const result = parseConsultResponse(response.data);

  return {
    ...mapBaseResult(result),
    session_id: result.sessionId ?? '',
    thread_slug: result.threadSlug ?? '',
    moderator_model: result.moderator.model_id,
    participant_count: result.participants.length,
    participants: result.participants.map(mapParticipant),
    thinking_level: result.metadata.thinking_level,
    total_credits: result.metadata.total_credits_used,
  };
};

export default {
  key: 'start_debatekit',
  noun: 'DebateKit',

  display: {
    label: 'Start a DebateKit',
    description:
      'Creates a DebateKit consultation where multiple AI models discuss your question, then a moderator synthesizes the results.',
  },

  operation: {
    perform,

    inputFields: [
      {
        key: 'prompt',
        label: 'Prompt',
        type: 'text',
        required: true,
        helpText: 'The question, topic, or problem for the AI council to discuss.',
      },
      THINKING_LEVEL_INPUT_FIELD,
      {
        key: 'mode',
        label: 'Mode',
        type: 'string',
        choices: [...CHAT_MODE_VALUES],
        required: false,
        helpText:
          'Conversation mode. Brainstorming = ideas, debating = tradeoffs, analyzing = research, solving = action plans.',
      },
      {
        key: 'context',
        label: 'Context',
        type: 'text',
        required: false,
        helpText:
          'Additional background context (code, docs, requirements) to include in the discussion.',
      },
    ],

    sample: {
      session_id: 'abc12345-6789-0000-aaaa-bbbbccccdddd',
      thread_slug: 'debatekit-rest-vs-graphql-a1b2c3',
      moderator_summary:
        'The council agrees that REST is better for simple CRUD APIs while GraphQL excels for complex, nested data requirements.',
      moderator_model: 'anthropic/claude-3.5-sonnet',
      participant_count: 3,
      duration_ms: 15000,
      thinking_level: 'medium',
      total_credits: 3,
    },

    outputFields: [
      { key: 'session_id', label: 'Session ID', type: 'string' },
      { key: 'thread_slug', label: 'Thread Slug', type: 'string' },
      { key: 'moderator_summary', label: 'Moderator Summary', type: 'string' },
      { key: 'moderator_model', label: 'Moderator Model', type: 'string' },
      { key: 'participant_count', label: 'Participant Count', type: 'integer' },
      { key: 'duration_ms', label: 'Duration (ms)', type: 'integer' },
      { key: 'thinking_level', label: 'Thinking Level', type: 'string' },
      { key: 'total_credits', label: 'Credits Used', type: 'number' },
    ],
  },
};
