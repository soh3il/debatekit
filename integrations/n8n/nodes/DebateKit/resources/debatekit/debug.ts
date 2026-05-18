import type { INodeProperties } from 'n8n-workflow';

import { createThinkingLevelField, showFor } from '../../shared/constants';

const displayOptions = { show: showFor('debatekit', 'debug') };

// Field values mirror integrations/shared/src/enums.ts (Debug endpoint)
export const debatekitDebugDescription: INodeProperties[] = [
	{
		displayName: 'Problem',
		name: 'problem',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		displayOptions,
		default: '',
		description: 'Describe the bug, failure, or unexpected behavior',
		routing: {
			send: {
				type: 'body',
				property: 'problem',
			},
		},
	},
	createThinkingLevelField(displayOptions, 'Analysis depth — higher uses more credits'),
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		displayOptions,
		default: {},
		options: [
			{
				displayName: 'Error Message',
				name: 'error',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				default: '',
				description: 'Error message, stack trace, or unexpected output',
				routing: {
					send: {
						type: 'body',
						property: 'error',
					},
				},
			},
			{
				displayName: 'Expected Behavior',
				name: 'expectedBehavior',
				type: 'string',
				typeOptions: {
					rows: 2,
				},
				default: '',
				description: 'What should happen vs what actually happens',
				routing: {
					send: {
						type: 'body',
						property: 'expected_behavior',
					},
				},
			},
			{
				displayName: 'Code',
				name: 'code',
				type: 'string',
				typeOptions: {
					rows: 8,
				},
				default: '',
				description: 'The relevant code where the bug occurs',
				routing: {
					send: {
						type: 'body',
						property: 'code',
					},
				},
			},
		],
	},
];
