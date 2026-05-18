import type { INodeProperties } from 'n8n-workflow';

import { showFor } from '../../shared/constants';
import { sessionGetDescription } from './get';
import { sessionGetAllDescription } from './getAll';

export const sessionDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showFor('session'),
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'List sessions',
				description: 'Retrieve a list of past DebateKit sessions',
				routing: {
					request: {
						method: 'GET',
						url: '/api/v1/sessions',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a session',
				description: 'Get the details of a single session by ID',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/v1/sessions/{{$parameter.sessionId}}',
					},
				},
			},
		],
		default: 'getAll',
	},
	...sessionGetAllDescription,
	...sessionGetDescription,
];
