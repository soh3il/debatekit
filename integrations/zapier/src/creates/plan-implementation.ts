import type { Bundle, ZObject } from 'zapier-platform-core';
import type { PlanImplementationInput, PlanImplementationRequestBody } from '../types';
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
  bundle: Bundle<PlanImplementationInput>
) => {
  const body: PlanImplementationRequestBody = {
    feature: bundle.inputData.feature,
  };

  if (bundle.inputData.codebase_context) {
    body.codebase_context = bundle.inputData.codebase_context;
  }

  if (bundle.inputData.constraints) {
    body.constraints = splitComma(bundle.inputData.constraints);
  }

  if (bundle.inputData.thinking_level) {
    body.thinking_level = bundle.inputData.thinking_level;
  }

  const response = await z.request({
    url: `${API_BASE}/api/v1/plan-implementation`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  return mapResultWithThinking(parseConsultResponse(response.data));
};

export default {
  key: 'plan_implementation',
  noun: 'Implementation Plan',

  display: {
    label: 'Plan Implementation',
    description:
      'Create a step-by-step implementation plan with multi-model input.',
  },

  operation: {
    perform,

    inputFields: [
      {
        key: 'feature',
        label: 'Feature',
        type: 'text',
        required: true,
        helpText: 'The feature or task to create an implementation plan for.',
      },
      {
        key: 'codebase_context',
        label: 'Codebase Context',
        type: 'text',
        required: false,
        helpText:
          'Relevant codebase context (architecture, patterns, conventions).',
      },
      {
        key: 'constraints',
        label: 'Constraints',
        type: 'string',
        required: false,
        helpText:
          'Comma-separated constraints (e.g., backward compatibility, performance targets).',
      },
      THINKING_LEVEL_INPUT_FIELD,
    ],

    sample: {
      sessionId: 'abc12345-6789-0000-aaaa-bbbbccccdddd',
      threadSlug: 'debatekit-plan-impl-a1b2c3',
      moderator_summary: 'Implementation should follow a phased approach starting with database schema changes.',
      participant_count: 3,
      duration_ms: 13000,
      thinking_level: 'medium',
    },

    outputFields: [
      ...BASE_OUTPUT_FIELDS,
      { key: 'thinking_level', label: 'Thinking Level', type: 'string' },
    ],
  },
};
