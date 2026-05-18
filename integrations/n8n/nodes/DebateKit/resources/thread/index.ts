import type { INodeProperties } from 'n8n-workflow';

import { showFor } from '../../shared/constants';
import { threadGetLinkDescription } from './getLink';
import { threadSetVisibilityDescription } from './setVisibility';

// Thread endpoints mirror the MCP REST API:
//   GET   /api/v1/threads/:sessionId/link
//   PATCH /api/v1/threads/:sessionId/visibility
export const threadDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showFor('thread'),
		},
		options: [
			{
				name: 'Get Link',
				value: 'getLink',
				action: 'Get thread link',
				description: 'Get the dashboard URL and public share link for a session',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/v1/threads/{{$parameter.sessionId}}/link',
					},
				},
			},
			{
				name: 'Set Visibility',
				value: 'setVisibility',
				action: 'Set thread visibility',
				description: 'Make a thread public or private',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/api/v1/threads/{{$parameter.sessionId}}/visibility',
					},
				},
			},
		],
		default: 'getLink',
	},
	...threadGetLinkDescription,
	...threadSetVisibilityDescription,
];
