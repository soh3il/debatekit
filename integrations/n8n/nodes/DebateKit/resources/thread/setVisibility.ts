import type { INodeProperties } from 'n8n-workflow';

import { showFor } from '../../shared/constants';

// Mirrors PATCH /api/v1/threads/:sessionId/visibility from the MCP REST API
// Input mirrors integrations/shared/src/enums.ts → set-thread-visibility endpoint
export const threadSetVisibilityDescription: INodeProperties[] = [
	{
		displayName: 'Session ID',
		name: 'sessionId',
		type: 'string',
		required: true,
		displayOptions: {
			show: showFor('thread', 'setVisibility'),
		},
		default: '',
		description: 'The session ID from a previous debate',
	},
	{
		displayName: 'Public',
		name: 'isPublic',
		type: 'boolean',
		required: true,
		displayOptions: {
			show: showFor('thread', 'setVisibility'),
		},
		default: false,
		description: 'Whether to make the thread publicly accessible',
		routing: {
			send: {
				type: 'body',
				property: 'is_public',
			},
		},
	},
];
