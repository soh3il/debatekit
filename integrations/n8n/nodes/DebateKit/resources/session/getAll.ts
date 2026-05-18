import type { INodeProperties } from 'n8n-workflow';

import { showFor, TOOL_NAME_OPTIONS } from '../../shared/constants';

export const sessionGetAllDescription: INodeProperties[] = [
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: showFor('session', 'getAll'),
		},
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		default: 50,
		description: 'Max number of results to return',
		routing: {
			send: {
				type: 'query',
				property: 'limit',
			},
		},
	},
	{
		displayName: 'Offset',
		name: 'offset',
		type: 'number',
		displayOptions: {
			show: showFor('session', 'getAll'),
		},
		typeOptions: {
			minValue: 0,
		},
		default: 0,
		description: 'Pagination offset',
		routing: {
			send: {
				type: 'query',
				property: 'offset',
			},
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		displayOptions: {
			show: showFor('session', 'getAll'),
		},
		default: {},
		options: [
			{
				displayName: 'Tool Name',
				name: 'tool_name',
				type: 'options',
				options: TOOL_NAME_OPTIONS,
				default: 'consult',
				description: 'Filter sessions by the tool that was used',
				routing: {
					send: {
						type: 'query',
						property: 'tool_name',
					},
				},
			},
		],
	},
];
