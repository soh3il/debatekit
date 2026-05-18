import type { INodeProperties } from 'n8n-workflow';

import { CHAT_MODE_OPTIONS, createThinkingLevelField, OUTPUT_FORMAT_OPTIONS, showFor } from '../../shared/constants';

const displayOptions = { show: showFor('debatekit', 'consult') };

// Field values mirror integrations/shared/src/enums.ts (ConsultInput via RunDebateInput)
export const debatekitConsultDescription: INodeProperties[] = [
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		displayOptions,
		default: '',
		description: 'The question, topic, or problem to discuss',
		routing: {
			send: {
				type: 'body',
				property: 'prompt',
			},
		},
	},
	createThinkingLevelField(displayOptions),
	{
		displayName: 'Mode',
		name: 'mode',
		type: 'options',
		displayOptions,
		options: CHAT_MODE_OPTIONS,
		default: 'brainstorming',
		description: 'Conversation mode that shapes how the AI models interact',
		routing: {
			send: {
				type: 'body',
				property: 'mode',
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
				displayName: 'Context',
				name: 'context',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				description: 'Additional background context (code, docs, requirements)',
				routing: {
					send: {
						type: 'body',
						property: 'context',
					},
				},
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				options: OUTPUT_FORMAT_OPTIONS,
				default: 'discussion',
				description: 'Moderator output format',
				routing: {
					send: {
						type: 'body',
						property: 'format',
					},
				},
			},
		],
	},
];
