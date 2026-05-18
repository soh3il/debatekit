import type { Bundle, ZObject } from 'zapier-platform-core';
import type { DebugIssueInput, DebugRequestBody } from '../types';
import { API_BASE } from '../constants';
import {
  parseConsultResponse,
  mapResultWithThinking,
  BASE_OUTPUT_FIELDS,
  THINKING_LEVEL_INPUT_FIELD,
} from '../helpers';

const perform = async (
  z: ZObject,
  bundle: Bundle<DebugIssueInput>
) => {
  const body: DebugRequestBody = {
    problem: bundle.inputData.problem,
  };

  if (bundle.inputData.error) {
    body.error = bundle.inputData.error;
  }

  if (bundle.inputData.expected_behavior) {
    body.expected_behavior = bundle.inputData.expected_behavior;
  }

  if (bundle.inputData.code) {
    body.code = bundle.inputData.code;
  }

  if (bundle.inputData.thinking_level) {
    body.thinking_level = bundle.inputData.thinking_level;
  }

  const response = await z.request({
    url: `${API_BASE}/api/v1/debug`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  return mapResultWithThinking(parseConsultResponse(response.data));
};

export default {
  key: 'debug_issue',
  noun: 'Debug',

  display: {
    label: 'Debug an Issue',
    description:
      'Debug a problem using multiple AI models analyzing from different angles, then a moderator synthesizes the root cause and fix.',
  },

  operation: {
    perform,

    inputFields: [
      {
        key: 'problem',
        label: 'Problem',
        type: 'text',
        required: true,
        helpText: 'Description of the bug or issue to debug.',
      },
      {
        key: 'error',
        label: 'Error Message',
        type: 'text',
        required: false,
        helpText: 'The error message or stack trace.',
      },
      {
        key: 'expected_behavior',
        label: 'Expected Behavior',
        type: 'text',
        required: false,
        helpText: 'What should happen instead.',
      },
      {
        key: 'code',
        label: 'Code',
        type: 'text',
        required: false,
        helpText: 'Relevant code snippet.',
      },
      THINKING_LEVEL_INPUT_FIELD,
    ],

    sample: {
      sessionId: 'abc12345-6789-0000-aaaa-bbbbccccdddd',
      threadSlug: 'debatekit-debug-null-ref-a1b2c3',
      moderator_summary:
        'The null reference occurs because the async call resolves before state initialization completes.',
      participant_count: 3,
      duration_ms: 12500,
      thinking_level: 'medium',
    },

    outputFields: [
      ...BASE_OUTPUT_FIELDS,
      { key: 'thinking_level', label: 'Thinking Level', type: 'string' },
    ],
  },
};
