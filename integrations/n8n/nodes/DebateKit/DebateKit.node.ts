import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { debatekitDescription } from './resources/debatekit';
import { sessionDescription } from './resources/session';
import { threadDescription } from './resources/thread';
import { usageDescription } from './resources/usage';

export class DebateKit implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'DebateKit',
    name: 'debatekit',
    icon: 'file:debatekit.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Multi-model AI brainstorming — consult, architect, review code, plan, debug, and assess tradeoffs with multiple AI perspectives',
    defaults: {
      name: 'DebateKit',
    },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'debatekitApi',
        required: true,
      },
    ],
    requestDefaults: {
      baseURL: '={{$credentials.baseUrl}}',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-debatekit-source': 'n8n',
      },
    },
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'DebateKit',
            value: 'debatekit',
            description: 'Run multi-model AI consultations',
          },
          {
            name: 'Session',
            value: 'session',
            description: 'View past consultation sessions',
          },
          {
            name: 'Thread',
            value: 'thread',
            description: 'Manage thread links and visibility',
          },
          {
            name: 'Usage',
            value: 'usage',
            description: 'Check credit balance and usage',
          },
        ],
        default: 'debatekit',
      },
      ...debatekitDescription,
      ...sessionDescription,
      ...threadDescription,
      ...usageDescription,
    ],
  };
}
