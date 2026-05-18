import type { z } from 'zod';

import { getCustomerId, searchGaql } from '../google-ads-client.js';
import type { CampaignReportSchema, SearchTermsReportSchema } from '../schemas.js';

export async function handleCampaignReport(
  input: z.infer<typeof CampaignReportSchema>,
): Promise<string> {
  const customerId = getCustomerId(input.customerId);

  let query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.cost_per_conversion
    FROM campaign
    WHERE campaign.status != 'REMOVED'
      AND segments.date DURING ${input.dateRange}
  `;

  if (input.campaignId) {
    query += `\n      AND campaign.id = ${input.campaignId}`;
  }

  query += '\n    ORDER BY metrics.cost_micros DESC';

  const results = await searchGaql(customerId, query);
  return JSON.stringify(results, null, 2);
}

export async function handleSearchTermsReport(
  input: z.infer<typeof SearchTermsReportSchema>,
): Promise<string> {
  const customerId = getCustomerId(input.customerId);

  let query = `
    SELECT
      search_term_view.search_term,
      search_term_view.status,
      campaign.name,
      ad_group.name,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.cost_micros,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date DURING ${input.dateRange}
  `;

  if (input.campaignId) {
    query += `\n      AND campaign.id = ${input.campaignId}`;
  }
  if (input.adGroupId) {
    query += `\n      AND ad_group.id = ${input.adGroupId}`;
  }

  query += '\n    ORDER BY metrics.impressions DESC\n    LIMIT 100';

  const results = await searchGaql(customerId, query);
  return JSON.stringify(results, null, 2);
}
