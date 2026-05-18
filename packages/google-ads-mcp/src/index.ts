import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  CampaignReportSchema,
  CreateAdGroupSchema,
  CreateBudgetSchema,
  CreateCampaignSchema,
  CreateKeywordSchema,
  CreateResponsiveSearchAdSchema,
  GetKeywordIdeasSchema,
  ListCustomersSchema,
  RemoveKeywordSchema,
  SearchGaqlSchema,
  SearchTermsReportSchema,
  UpdateCampaignStatusSchema,
} from './schemas.js';
import { handleListCustomers } from './tools/accounts.js';
import { handleCreateAdGroup } from './tools/ad-groups.js';
import { handleCreateResponsiveSearchAd } from './tools/ads.js';
import { handleCreateBudget } from './tools/budgets.js';
import { handleCreateCampaign, handleUpdateCampaignStatus } from './tools/campaigns.js';
import { handleCreateKeyword, handleGetKeywordIdeas, handleRemoveKeyword } from './tools/keywords.js';
import { handleCampaignReport, handleSearchTermsReport } from './tools/reports.js';
import { handleSearchGaql } from './tools/search.js';

// Load .env from package directory
const envPath = resolve(import.meta.dirname, '../.env');
// eslint-disable-next-line security/detect-non-literal-fs-filename
if (existsSync(envPath)) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const server = new McpServer({
  name: 'google-ads',
  version: '0.1.0',
});

// --- Account tools ---
server.tool('list-customers', 'List all accessible Google Ads customer accounts', ListCustomersSchema.shape, async () => {
  const result = await handleListCustomers();
  return { content: [{ type: 'text', text: result }] };
});

// --- Search / Query ---
server.tool(
  'search-gaql',
  'Run a GAQL (Google Ads Query Language) query — the universal read tool for any Google Ads data',
  SearchGaqlSchema.shape,
  async (input) => {
    const result = await handleSearchGaql(input);
    return { content: [{ type: 'text', text: result }] };
  },
);

// --- Campaign tools ---
server.tool(
  'create-campaign',
  'Create a new Google Ads campaign (Search, Display, Shopping, Video, or Performance Max)',
  CreateCampaignSchema.shape,
  async (input) => {
    const result = await handleCreateCampaign(input);
    return { content: [{ type: 'text', text: result }] };
  },
);

server.tool(
  'update-campaign-status',
  'Update a campaign status (enable, pause, or remove)',
  UpdateCampaignStatusSchema.shape,
  async (input) => {
    const result = await handleUpdateCampaignStatus(input);
    return { content: [{ type: 'text', text: result }] };
  },
);

// --- Budget tools ---
server.tool(
  'create-budget',
  'Create a campaign budget (amount in micros, e.g. 10000000 = $10/day)',
  CreateBudgetSchema.shape,
  async (input) => {
    const result = await handleCreateBudget(input);
    return { content: [{ type: 'text', text: result }] };
  },
);

// --- Ad Group tools ---
server.tool(
  'create-ad-group',
  'Create an ad group within a campaign',
  CreateAdGroupSchema.shape,
  async (input) => {
    const result = await handleCreateAdGroup(input);
    return { content: [{ type: 'text', text: result }] };
  },
);

// --- Keyword tools ---
server.tool(
  'create-keyword',
  'Add a keyword to an ad group with specified match type (EXACT, PHRASE, BROAD)',
  CreateKeywordSchema.shape,
  async (input) => {
    const result = await handleCreateKeyword(input);
    return { content: [{ type: 'text', text: result }] };
  },
);

server.tool(
  'remove-keyword',
  'Remove a keyword from an ad group',
  RemoveKeywordSchema.shape,
  async (input) => {
    const result = await handleRemoveKeyword(input);
    return { content: [{ type: 'text', text: result }] };
  },
);

server.tool(
  'get-keyword-ideas',
  'Get keyword suggestions from seed keywords or a URL via KeywordPlanIdeaService',
  GetKeywordIdeasSchema.shape,
  async (input) => {
    const result = await handleGetKeywordIdeas(input);
    return { content: [{ type: 'text', text: result }] };
  },
);

// --- Ad tools ---
server.tool(
  'create-responsive-search-ad',
  'Create a responsive search ad with multiple headlines and descriptions',
  CreateResponsiveSearchAdSchema.shape,
  async (input) => {
    const result = await handleCreateResponsiveSearchAd(input);
    return { content: [{ type: 'text', text: result }] };
  },
);

// --- Report tools ---
server.tool(
  'get-campaign-report',
  'Get campaign performance report (impressions, clicks, CTR, cost, conversions)',
  CampaignReportSchema.shape,
  async (input) => {
    const result = await handleCampaignReport(input);
    return { content: [{ type: 'text', text: result }] };
  },
);

server.tool(
  'get-search-terms-report',
  'Get search terms report showing what users actually searched for',
  SearchTermsReportSchema.shape,
  async (input) => {
    const result = await handleSearchTermsReport(input);
    return { content: [{ type: 'text', text: result }] };
  },
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
