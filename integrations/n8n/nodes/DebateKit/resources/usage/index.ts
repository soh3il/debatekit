import type { INodeProperties } from 'n8n-workflow';

import { showFor } from '../../shared/constants';

export const usageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showFor('usage'),
		},
		options: [
			{
				name: 'Check Balance',
				value: 'checkBalance',
				action: 'Check credit balance',
				description: 'Check your current DebateKit credit balance and usage',
				routing: {
					request: {
						method: 'GET',
						url: '/api/v1/sessions',
						qs: {
							limit: '1',
						},
					},
					output: {
						postReceive: [
							{
								type: 'set',
								properties: {
									value: '={{ { "message": "Credit check completed. See session history for usage details.", "sessions_count": $response.body.count } }}',
								},
							},
						],
					},
				},
			},
		],
		default: 'checkBalance',
	},
];
