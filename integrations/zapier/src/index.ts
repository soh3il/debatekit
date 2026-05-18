import type { Bundle, HttpRequestOptions, ZObject } from 'zapier-platform-core';
import { API_KEY_HEADER } from './shared-constants';
import * as packageJson from '../package.json';
import authentication from './authentication';
import assessTradeoffsCreate from './creates/assess-tradeoffs';
import debugIssueCreate from './creates/debug-issue';
import designArchitectureCreate from './creates/design-architecture';
import planImplementationCreate from './creates/plan-implementation';
import reviewCodeCreate from './creates/review-code';
import startDebateKitCreate from './creates/start-debatekit';
import findSessionSearch from './searches/find-session';
import getThreadLinkSearch from './searches/get-thread-link';
import newSessionTrigger from './triggers/new-session';

import zapierPlatformCore from 'zapier-platform-core';

const addAuthHeader = (
  request: HttpRequestOptions,
  z: ZObject,
  bundle: Bundle
) => {
  if (!bundle.authData.api_key) {
    throw new z.errors.HaltedError('DebateKit API key is required. Please connect your account first.');
  }
  request.headers = request.headers || {};
  request.headers[API_KEY_HEADER] = bundle.authData.api_key;
  request.headers['x-debatekit-source'] = 'zapier';
  return request;
};

export default {
  version: packageJson.version,
  platformVersion: zapierPlatformCore.version,

  authentication,

  beforeRequest: [addAuthHeader],
  afterResponse: [],

  triggers: {
    [newSessionTrigger.key]: newSessionTrigger,
  },

  creates: {
    [startDebateKitCreate.key]: startDebateKitCreate,
    [debugIssueCreate.key]: debugIssueCreate,
    [reviewCodeCreate.key]: reviewCodeCreate,
    [designArchitectureCreate.key]: designArchitectureCreate,
    [planImplementationCreate.key]: planImplementationCreate,
    [assessTradeoffsCreate.key]: assessTradeoffsCreate,
  },

  searches: {
    [findSessionSearch.key]: findSessionSearch,
    [getThreadLinkSearch.key]: getThreadLinkSearch,
  },
};
