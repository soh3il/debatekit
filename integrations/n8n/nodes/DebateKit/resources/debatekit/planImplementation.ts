import type { INodeProperties } from 'n8n-workflow';

import { COMMA_SPLIT_EXPRESSION, createThinkingLevelField, showFor } from '../../shared/constants';

const displayOptions = { show: showFor('debatekit', 'planImplementation') };

// Field values mirror integrations/shared/src/enums.ts (PlanImplementation endpoint)
export const debatekitPlanImplementationDescription: INodeProperties[] = [
	{
		displayName: 'Feature',
		name: 'feature',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		displayOptions,
		default: '',
		description: 'The feature or change to plan',
		routing: {
			send: {
				type: 'body',
				property: 'feature',
			},
		},
	},
	createThinkingLevelField(displayOptions, 'Planning depth — higher uses more credits'),
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		displayOptions,
		default: {},
		options: [
			{
				displayName: 'Tech Stack',
				name: 'techStack',
				type: 'string',
				default: '',
				description: 'Comma-separated list of current technologies',
				routing: {
					send: {
						type: 'body',
						property: 'tech_stack',
						value: COMMA_SPLIT_EXPRESSION,
					},
				},
			},
			{
				displayName: 'Constraints',
				name: 'constraints',
				type: 'string',
				default: '',
				description: 'Comma-separated constraints (e.g., "no breaking changes, must support offline")',
				routing: {
					send: {
						type: 'body',
						property: 'constraints',
						value: COMMA_SPLIT_EXPRESSION,
					},
				},
			},
			{
				displayName: 'Codebase Context',
				name: 'codebaseContext',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				description: 'Relevant existing code, file structure, or architecture notes',
				routing: {
					send: {
						type: 'body',
						property: 'codebase_context',
					},
				},
			},
		],
	},
];
