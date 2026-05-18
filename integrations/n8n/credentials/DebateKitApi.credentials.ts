import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DebateKitApi implements ICredentialType {
	name = 'debatekitApi';

	displayName = 'DebateKit API';

	icon = { light: 'file:../nodes/DebateKit/debatekit.svg', dark: 'file:../nodes/DebateKit/debatekit.svg' } as const;

	documentationUrl = 'https://debatekit.com';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your DebateKit API key. Generate one at https://debatekit.com/chat/settings/api-keys.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://mcp.debatekit.com',
			description: 'DebateKit API base URL. Override for self-hosted instances.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/v1/sessions',
			method: 'GET',
			qs: {
				limit: '1',
			},
		},
	};
}
