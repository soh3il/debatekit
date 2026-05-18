import type { Bundle, ZObject } from 'zapier-platform-core';
import type { ReviewCodeInput, ReviewCodeRequestBody } from '../types';
import { API_BASE } from '../constants';
import {
  parseConsultResponse,
  mapBaseResult,
  splitComma,
  BASE_OUTPUT_FIELDS,
  THINKING_LEVEL_INPUT_FIELD,
} from '../helpers';

const perform = async (
  z: ZObject,
  bundle: Bundle<ReviewCodeInput>
) => {
  const body: ReviewCodeRequestBody = {
    code: bundle.inputData.code,
  };

  if (bundle.inputData.language) {
    body.language = bundle.inputData.language;
  }

  if (bundle.inputData.focus) {
    body.focus = splitComma(bundle.inputData.focus);
  }

  if (bundle.inputData.thinking_level) {
    body.thinking_level = bundle.inputData.thinking_level;
  }

  const response = await z.request({
    url: `${API_BASE}/api/v1/review-code`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  return mapBaseResult(parseConsultResponse(response.data));
};

export default {
  key: 'review_code',
  noun: 'Code Review',

  display: {
    label: 'Review Code',
    description:
      'Get a multi-perspective code review from multiple AI models covering security, performance, and quality.',
  },

  operation: {
    perform,

    inputFields: [
      {
        key: 'code',
        label: 'Code',
        type: 'text',
        required: true,
        helpText: 'The code to review.',
      },
      {
        key: 'language',
        label: 'Language',
        type: 'string',
        required: false,
        helpText: 'Programming language (e.g., typescript, python).',
      },
      {
        key: 'focus',
        label: 'Focus Areas',
        type: 'string',
        required: false,
        helpText:
          'Comma-separated focus areas (e.g., security, performance, readability).',
      },
      THINKING_LEVEL_INPUT_FIELD,
    ],

    sample: {
      sessionId: 'abc12345-6789-0000-aaaa-bbbbccccdddd',
      threadSlug: 'debatekit-code-review-a1b2c3',
      moderator_summary: 'The code has good structure but needs input validation and error handling improvements.',
      participant_count: 3,
      duration_ms: 10000,
    },

    outputFields: [...BASE_OUTPUT_FIELDS],
  },
};
