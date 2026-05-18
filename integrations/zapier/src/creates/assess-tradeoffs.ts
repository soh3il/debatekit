import type { Bundle, ZObject } from 'zapier-platform-core';
import type { AssessTradeoffsInput, AssessTradeoffsRequestBody } from '../types';
import { API_BASE } from '../constants';
import {
  parseConsultResponse,
  mapResultWithThinking,
  splitComma,
  BASE_OUTPUT_FIELDS,
  THINKING_LEVEL_INPUT_FIELD,
} from '../helpers';

const perform = async (
  z: ZObject,
  bundle: Bundle<AssessTradeoffsInput>
) => {
  const body: AssessTradeoffsRequestBody = {
    decision: bundle.inputData.decision,
    options: splitComma(bundle.inputData.options),
  };

  if (bundle.inputData.priorities) {
    body.priorities = splitComma(bundle.inputData.priorities);
  }

  if (bundle.inputData.thinking_level) {
    body.thinking_level = bundle.inputData.thinking_level;
  }

  const response = await z.request({
    url: `${API_BASE}/api/v1/assess-tradeoffs`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  return mapResultWithThinking(parseConsultResponse(response.data));
};

export default {
  key: 'assess_tradeoffs',
  noun: 'Tradeoff Assessment',

  display: {
    label: 'Assess Tradeoffs',
    description:
      'Evaluate options and trade-offs with structured multi-model analysis.',
  },

  operation: {
    perform,

    inputFields: [
      {
        key: 'decision',
        label: 'Decision',
        type: 'text',
        required: true,
        helpText: 'The decision or question to evaluate trade-offs for.',
      },
      {
        key: 'options',
        label: 'Options',
        type: 'string',
        required: true,
        helpText:
          'Comma-separated options to compare (e.g., REST, GraphQL, gRPC).',
      },
      {
        key: 'priorities',
        label: 'Priorities',
        type: 'string',
        required: false,
        helpText:
          'Comma-separated priorities — what matters most (e.g., performance, dx, cost).',
      },
      THINKING_LEVEL_INPUT_FIELD,
    ],

    sample: {
      sessionId: 'abc12345-6789-0000-aaaa-bbbbccccdddd',
      threadSlug: 'debatekit-tradeoffs-a1b2c3',
      moderator_summary: 'REST is the best fit given the team size and timeline constraints.',
      participant_count: 3,
      duration_ms: 11000,
      thinking_level: 'medium',
    },

    outputFields: [
      ...BASE_OUTPUT_FIELDS,
      { key: 'thinking_level', label: 'Thinking Level', type: 'string' },
    ],
  },
};
