import type { INodeProperties } from 'n8n-workflow';

import { showFor } from '../../shared/constants';
import { debatekitArchitectDescription } from './architect';
import { debatekitAssessTradeoffsDescription } from './assessTradeoffs';
import { debatekitConsultDescription } from './consult';
import { debatekitDebugDescription } from './debug';
import { debatekitPlanImplementationDescription } from './planImplementation';
import { debatekitReviewCodeDescription } from './reviewCode';

// Operation values and their routing URLs mirror the MCP server REST API.
// Endpoint names mirror integrations/shared/src/enums.ts → API_TOOL_NAMES.
export const debatekitDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showFor('debatekit'),
		},
		options: [
			{
				name: 'Architect',
				value: 'architect',
				action: 'Design system architecture',
				description: 'Get system architecture recommendations from multiple AI models',
				routing: {
					request: {
						method: 'POST',
						url: '/api/v1/architect',
					},
				},
			},
			{
				name: 'Assess Tradeoffs',
				value: 'assessTradeoffs',
				action: 'Assess tradeoffs for a decision',
				description: 'Evaluate options from multiple angles — short-term vs long-term, risk vs reward',
				routing: {
					request: {
						method: 'POST',
						url: '/api/v1/assess-tradeoffs',
					},
				},
			},
			{
				name: 'Consult',
				value: 'consult',
				action: 'Run a multi model consultation',
				description: 'Run a multi-model AI brainstorming session on any topic',
				routing: {
					request: {
						method: 'POST',
						url: '/api/v1/consult',
					},
				},
			},
			{
				name: 'Debug',
				value: 'debug',
				action: 'Debug a problem',
				description: 'Get collaborative debugging analysis from multiple AI models',
				routing: {
					request: {
						method: 'POST',
						url: '/api/v1/debug',
					},
				},
			},
			{
				name: 'Plan Implementation',
				value: 'planImplementation',
				action: 'Plan a feature implementation',
				description: 'Break down a feature into actionable steps with risks and acceptance criteria',
				routing: {
					request: {
						method: 'POST',
						url: '/api/v1/plan-implementation',
					},
				},
			},
			{
				name: 'Review Code',
				value: 'reviewCode',
				action: 'Review code',
				description: 'Get a multi-perspective code review from AI models',
				routing: {
					request: {
						method: 'POST',
						url: '/api/v1/review-code',
					},
				},
			},
		],
		default: 'consult',
	},
	...debatekitConsultDescription,
	...debatekitArchitectDescription,
	...debatekitReviewCodeDescription,
	...debatekitPlanImplementationDescription,
	...debatekitDebugDescription,
	...debatekitAssessTradeoffsDescription,
];
