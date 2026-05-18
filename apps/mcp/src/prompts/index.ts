/**
 * MCP Prompt Templates
 *
 * Preset debate workflows exposed as MCP prompts.
 * Clients present these as slash commands or quick actions.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    'quick-consult',
    {
      argsSchema: { question: z.string().describe('The question to discuss') },
      description: 'Fast, cheap AI council opinion on a question',
      title: 'Quick Consult',
    },
    ({ question }) => ({
      messages: [{
        content: { text: `Use the consult-council tool with thinking_level "low" to quickly discuss: ${question}`, type: 'text' as const },
        role: 'user' as const,
      }],
    }),
  );

  server.registerPrompt(
    'deep-review',
    {
      argsSchema: { code: z.string().describe('The code to review') },
      description: 'High-thinking code review with security + performance focus',
      title: 'Deep Code Review',
    },
    ({ code }) => ({
      messages: [{
        content: { text: `Use the review-code tool with thinking_level "high" and focus ["security", "performance"] to review:\n\n${code}`, type: 'text' as const },
        role: 'user' as const,
      }],
    }),
  );

  server.registerPrompt(
    'architecture-decision',
    {
      argsSchema: { description: z.string().describe('What the system should do') },
      description: 'Full architecture council for design decisions',
      title: 'Architecture Decision',
    },
    ({ description }) => ({
      messages: [{
        content: { text: `Use the design-architecture tool to design the architecture for: ${description}`, type: 'text' as const },
        role: 'user' as const,
      }],
    }),
  );
}
