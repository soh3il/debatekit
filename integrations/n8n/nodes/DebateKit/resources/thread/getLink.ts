import type { INodeProperties } from 'n8n-workflow';

import { showFor } from '../../shared/constants';

// Mirrors GET /api/v1/threads/:sessionId/link from the MCP REST API
export const threadGetLinkDescription: INodeProperties[] = [
	{
		displayName: 'Session ID',
		name: 'sessionId',
		type: 'string',
		required: true,
		displayOptions: {
			show: showFor('thread', 'getLink'),
		},
		default: '',
		description: 'The session ID to get the thread link for',
	},
];
