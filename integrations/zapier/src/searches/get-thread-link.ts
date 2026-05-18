import type { Bundle, ZObject } from 'zapier-platform-core';
import { ThreadLinkResponseSchema } from '../shared-constants';
import type { GetThreadLinkInput } from '../types';
import { API_BASE } from '../constants';

const perform = async (
  z: ZObject,
  bundle: Bundle<GetThreadLinkInput>
) => {
  const response = await z.request({
    url: `${API_BASE}/api/v1/threads/${bundle.inputData.session_id}/link`,
  });

  if (response.status === 404) {
    return [];
  }

  const data = ThreadLinkResponseSchema.parse(response.data);

  return [
    {
      session_id: bundle.inputData.session_id,
      public_url: data.publicUrl,
      dashboard_url: data.dashboardUrl,
      is_public: data.isPublic,
    },
  ];
};

export default {
  key: 'get_thread_link',
  noun: 'Thread Link',

  display: {
    label: 'Get Thread Link',
    description: 'Get a shareable link to a DebateKit session thread.',
  },

  operation: {
    perform,

    inputFields: [
      {
        key: 'session_id',
        label: 'Session ID',
        type: 'string',
        required: true,
        helpText: 'The ID of the session to get a thread link for.',
      },
    ],

    sample: {
      session_id: 'abc12345-6789-0000-aaaa-bbbbccccdddd',
      public_url: 'https://debatekit.ai/public/chat/debatekit-rest-vs-graphql-a1b2c3',
      dashboard_url: 'https://debatekit.ai/chat/debatekit-rest-vs-graphql-a1b2c3',
      is_public: true,
    },

    outputFields: [
      { key: 'session_id', label: 'Session ID', type: 'string' },
      { key: 'public_url', label: 'Public URL', type: 'string' },
      { key: 'dashboard_url', label: 'Dashboard URL', type: 'string' },
      { key: 'is_public', label: 'Is Public', type: 'boolean' },
    ],
  },
};
