/**
 * FRED (Federal Reserve Economic Data) Service
 *
 * Fetches macro-economic time series from the St. Louis Fed.
 * API: https://fred.stlouisfed.org/docs/api/ (free key, 120 req/min)
 *
 * Flow:
 * 1. Extract economic terms from user message
 * 2. Search FRED for matching series
 * 3. Fetch latest observations for top series
 * 4. Format as markdown context with citation IDs
 */

import { z } from 'zod';

import type { CitableSource } from '@/types/citations';

import type { DataSourceResult, DomainSourceEnv } from './registry';

const FRED_BASE = 'https://api.stlouisfed.org/fred';

const FredSeriesSchema = z.object({
  frequency: z.string(),
  id: z.string(),
  last_updated: z.string(),
  notes: z.string(),
  observation_end: z.string(),
  observation_start: z.string(),
  seasonal_adjustment: z.string(),
  title: z.string(),
  units: z.string(),
});

const FredSeriesSearchResultSchema = z.object({
  seriess: z.array(FredSeriesSchema),
});

const FredObservationSchema = z.object({
  date: z.string(),
  value: z.string(),
});
type FredObservation = z.infer<typeof FredObservationSchema>;

type FredSeriesSearchResult = z.infer<typeof FredSeriesSearchResultSchema>;

const FredObservationsResultSchema = z.object({
  observations: z.array(FredObservationSchema),
});

/**
 * Extract economic/macro terms from user message.
 */
function extractEconomicQuery(userMessage: string): string {
  const cleaned = userMessage
    .replace(/(?:what (?:is|are)|tell me about|show me|current|latest|trend|how (?:is|are)|get me)\s*/gi, '')
    .replace(/[?.!,]/g, '')
    .trim();
  return cleaned || userMessage.slice(0, 100);
}

/**
 * Search FRED for series matching the query.
 */
async function searchFredSeries(query: string, apiKey: string, limit = 5): Promise<FredSeriesSearchResult['seriess']> {
  const params = new URLSearchParams({
    api_key: apiKey,
    file_type: 'json',
    limit: String(limit),
    order_by: 'search_rank',
    search_text: query,
  });

  try {
    const res = await fetch(`${FRED_BASE}/series/search?${params}`);
    if (!res.ok) {
      return [];
    }
    const data = FredSeriesSearchResultSchema.parse(await res.json());
    return data.seriess ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch the most recent observations for a FRED series.
 */
async function fetchRecentObservations(seriesId: string, apiKey: string, limit = 12): Promise<FredObservation[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    file_type: 'json',
    limit: String(limit),
    series_id: seriesId,
    sort_order: 'desc',
  });

  try {
    const res = await fetch(`${FRED_BASE}/series/observations?${params}`);
    if (!res.ok) {
      return [];
    }
    const data = FredObservationsResultSchema.parse(await res.json());
    return (data.observations ?? []).filter(o => o.value !== '.');
  } catch {
    return [];
  }
}

/**
 * Main fetch function for FRED data source.
 */
export async function fetchFredData(
  userMessage: string,
  _config?: Record<string, string>,
  env?: DomainSourceEnv,
): Promise<DataSourceResult> {
  const apiKey = env?.FRED_API_KEY || '';
  if (!apiKey) {
    return {
      formattedPrompt: '\n\n## FRED Economic Data\nFRED API key not configured. Set FRED_API_KEY environment variable.',
    };
  }

  const query = extractEconomicQuery(userMessage);
  const series = await searchFredSeries(query, apiKey);

  if (series.length === 0) {
    return {
      formattedPrompt: `\n\n## FRED Economic Data\nNo economic series found for "${query}". Try more specific economic terms (GDP, CPI, unemployment, federal funds rate, etc.).`,
    };
  }

  // Fetch observations for top 3 series in parallel
  const topSeries = series.slice(0, 3);
  const observationResults = await Promise.all(
    topSeries.map(s => fetchRecentObservations(s.id, apiKey, 6)),
  );

  const citableSources: CitableSource[] = [];
  const seriesEntries = topSeries.map((s, idx) => {
    const observations = observationResults[idx] ?? [];
    const fredUrl = `https://fred.stlouisfed.org/series/${s.id}`;
    const citationId = `dom_fred_${s.id.toLowerCase()}`;

    citableSources.push({
      content: `${s.title} (${s.units}, ${s.frequency}). Last updated: ${s.last_updated}`,
      id: citationId,
      metadata: {
        description: `FRED Series: ${s.title} — ${s.units}, ${s.frequency}`,
        domain: 'fred.stlouisfed.org',
        query,
        url: fredUrl,
      },
      sourceId: `fred-${s.id}`,
      title: `FRED: ${s.title}`,
      type: 'domain',
    });

    const obsTable = observations.length > 0
      ? observations.map(o => `  - ${o.date}: ${o.value}`).join('\n')
      : '  No recent observations available';

    return `[${citationId}] **${s.title}** (${s.id})
Units: ${s.units} | Frequency: ${s.frequency} | Seasonal Adj: ${s.seasonal_adjustment}
URL: ${fredUrl}

Recent Values:
${obsTable}`;
  });

  const formattedPrompt = `

## FRED: Economic Data
### Search: "${query}"

${seriesEntries.join('\n\n')}

*${topSeries.length} series retrieved from Federal Reserve Economic Data (${new Date().toISOString().split('T')[0]}). Cite using [fred_SERIES_ID] identifiers. Data subject to revisions — verify for investment decisions.*`;

  return { citableSources, formattedPrompt };
}
