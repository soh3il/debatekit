import type { INodeProperties } from 'n8n-workflow';

import { COMMA_SPLIT_EXPRESSION, createThinkingLevelField, showFor } from '../../shared/constants';

const displayOptions = { show: showFor('debatekit', 'reviewCode') };

// Field values mirror integrations/shared/src/enums.ts (ReviewCode endpoint)
export const debatekitReviewCodeDescription: INodeProperties[] = [
	{
		displayName: 'Code',
		name: 'code',
		type: 'string',
		typeOptions: {
			rows: 10,
		},
		required: true,
		displayOptions,
		default: '',
		description: 'The code to review',
		routing: {
			send: {
				type: 'body',
				property: 'code',
			},
		},
	},
	createThinkingLevelField(displayOptions),
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		displayOptions,
		default: {},
		options: [
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				description: 'Programming language (auto-detected if not specified)',
				routing: {
					send: {
						type: 'body',
						property: 'language',
					},
				},
			},
			{
				displayName: 'Focus Areas',
				name: 'focus',
				type: 'string',
				default: '',
				description: 'Comma-separated review focus areas (e.g., "security, performance")',
				routing: {
					send: {
						type: 'body',
						property: 'focus',
						value: COMMA_SPLIT_EXPRESSION,
					},
				},
			},
		],
	},
];
