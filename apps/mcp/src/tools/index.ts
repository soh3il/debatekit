import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { Env } from '../types';
import { register as registerArchitect } from './architect';
import { register as registerAssessTradeoffs } from './assess-tradeoffs';
import { register as registerCheckUsage } from './check-usage';
import { register as registerConsult } from './consult';
import { register as registerDebug } from './debug';
import { register as registerGetLogs } from './get-logs';
import { register as registerGetSession } from './get-session';
import { register as registerGetThreadLink } from './get-thread-link';
import { register as registerListModels } from './list-models';
import { register as registerListSessions } from './list-sessions';
import { register as registerPlanImplementation } from './plan-implementation';
import { register as registerReviewCode } from './review-code';
import { register as registerSetThreadVisibility } from './set-thread-visibility';

export function registerTools(server: McpServer, env: Env, ctx: ExecutionContext) {
  registerListModels(server, env);
  registerListSessions(server, env);
  registerGetSession(server, env);
  registerGetLogs(server, env);
  registerCheckUsage(server, env);
  registerGetThreadLink(server, env);
  registerSetThreadVisibility(server, env);
  registerConsult(server, env, ctx);
  registerArchitect(server, env, ctx);
  registerReviewCode(server, env, ctx);
  registerPlanImplementation(server, env, ctx);
  registerDebug(server, env, ctx);
  registerAssessTradeoffs(server, env, ctx);
}
