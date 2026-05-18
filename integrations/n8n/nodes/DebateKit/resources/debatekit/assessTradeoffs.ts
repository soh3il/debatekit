import type { INodeProperties } from 'n8n-workflow';

import { COMMA_SPLIT_EXPRESSION, createThinkingLevelField, showFor } from '../../shared/constants';

const displayOptions = { show: showFor('debatekit', 'assessTradeoffs') };

// Field values mirror integrations/shared/src/enums.ts (AssessTradeoffs endpoint)
export const debatekitAssessTradeoffsDescription: INodeProperties[] = [
	{
		displayName: 'Decision',
		name: 'decision',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		displayOptions,
		default: '',
		description: 'The decision or question to evaluate',
		routing: {
			send: {
				type: 'body',
				property: 'decision',
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
				displayName: 'Options',
				name: 'options',
				type: 'string',
				default: '',
				description: 'Comma-separated options to compare (min 2)',
				routing: {
					send: {
						type: 'body',
						property: 'options',
						value: COMMA_SPLIT_EXPRESSION,
					},
				},
			},
			{
				displayName: 'Priorities',
				name: 'priorities',
				type: 'string',
				default: '',
				description: 'Comma-separated priority areas (e.g., "performance, dx, cost")',
				routing: {
					send: {
						type: 'body',
						property: 'priorities',
						value: COMMA_SPLIT_EXPRESSION,
					},
				},
			},
			{
				displayName: 'Context',
				name: 'context',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				description: 'Background context — codebase, team, timeline, constraints',
				routing: {
					send: {
						type: 'body',
						property: 'context',
					},
				},
			},
		],
	},
];
