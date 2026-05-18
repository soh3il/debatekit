import type { INodeProperties } from 'n8n-workflow';

import { ARCHITECT_SCALE_OPTIONS, COMMA_SPLIT_EXPRESSION, showFor } from '../../shared/constants';

const displayOptions = { show: showFor('debatekit', 'architect') };

// Field values mirror integrations/shared/src/enums.ts → ArchitectScales
export const debatekitArchitectDescription: INodeProperties[] = [
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		displayOptions,
		default: '',
		description: 'What the system should do',
		routing: {
			send: {
				type: 'body',
				property: 'description',
			},
		},
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		displayOptions,
		default: {},
		options: [
			{
				displayName: 'Scale',
				name: 'scale',
				type: 'options',
				options: ARCHITECT_SCALE_OPTIONS,
				default: 'startup',
				description: 'Expected scale of the system',
				routing: {
					send: {
						type: 'body',
						property: 'scale',
					},
				},
			},
			{
				displayName: 'Tech Stack',
				name: 'techStack',
				type: 'string',
				default: '',
				description: 'Comma-separated list of preferred technologies',
				routing: {
					send: {
						type: 'body',
						property: 'tech_stack',
						value: COMMA_SPLIT_EXPRESSION,
					},
				},
			},
			{
				displayName: 'Focus Areas',
				name: 'focusAreas',
				type: 'string',
				default: '',
				description: 'Comma-separated priority areas (e.g., "security, performance")',
				routing: {
					send: {
						type: 'body',
						property: 'focus_areas',
						value: COMMA_SPLIT_EXPRESSION,
					},
				},
			},
		],
	},
];
