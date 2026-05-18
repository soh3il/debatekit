import type { INodeProperties } from 'n8n-workflow';

import { showFor } from '../../shared/constants';

export const sessionGetDescription: INodeProperties[] = [
	{
		displayName: 'Session ID',
		name: 'sessionId',
		type: 'string',
		required: true,
		displayOptions: {
			show: showFor('session', 'get'),
		},
		default: '',
		description: 'The ID of the session to retrieve',
	},
];
