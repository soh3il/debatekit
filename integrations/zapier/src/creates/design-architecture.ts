import type { Bundle, ZObject } from 'zapier-platform-core';
import { ARCHITECT_SCALE_VALUES } from '../shared-constants';
import type { DesignArchitectureInput, ArchitectRequestBody } from '../types';
import { API_BASE } from '../constants';
import {
  parseConsultResponse,
  mapBaseResult,
  splitComma,
  BASE_OUTPUT_FIELDS,
} from '../helpers';

const perform = async (
  z: ZObject,
  bundle: Bundle<DesignArchitectureInput>
) => {
  const body: ArchitectRequestBody = {
    description: bundle.inputData.description,
  };

  if (bundle.inputData.scale) {
    body.scale = bundle.inputData.scale;
  }

  if (bundle.inputData.tech_stack) {
    body.tech_stack = splitComma(bundle.inputData.tech_stack);
  }

  if (bundle.inputData.focus_areas) {
    body.focus_areas = splitComma(bundle.inputData.focus_areas);
  }

  const response = await z.request({
    url: `${API_BASE}/api/v1/architect`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  return mapBaseResult(parseConsultResponse(response.data));
};

export default {
  key: 'design_architecture',
  noun: 'Architecture',

  display: {
    label: 'Design Architecture',
    description:
      'Get architectural recommendations from multiple AI models for system design decisions.',
  },

  operation: {
    perform,

    inputFields: [
      {
        key: 'description',
        label: 'Description',
        type: 'text',
        required: true,
        helpText: 'System description or architectural question.',
      },
      {
        key: 'scale',
        label: 'Scale',
        type: 'string',
        choices: [...ARCHITECT_SCALE_VALUES],
        default: 'startup',
        required: false,
        helpText: 'Expected scale of the system.',
      },
      {
        key: 'tech_stack',
        label: 'Tech Stack',
        type: 'string',
        required: false,
        helpText:
          'Comma-separated list of preferred technologies (e.g., typescript, postgres, redis).',
      },
      {
        key: 'focus_areas',
        label: 'Focus Areas',
        type: 'string',
        required: false,
        helpText:
          'Comma-separated focus areas (e.g., scalability, cost, security).',
      },
    ],

    sample: {
      sessionId: 'abc12345-6789-0000-aaaa-bbbbccccdddd',
      threadSlug: 'debatekit-architecture-a1b2c3',
      moderator_summary: 'A microservices approach with event-driven communication is recommended for this scale.',
      participant_count: 3,
      duration_ms: 14000,
    },

    outputFields: [...BASE_OUTPUT_FIELDS],
  },
};
