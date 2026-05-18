/**
 * Domain Data Source Registry
 *
 * Maps data source IDs to their fetch functions.
 * Data sources provide domain-specific context to LLM participants
 * by fetching from external APIs (SEC EDGAR, PubMed, etc.)
 */

import type { DataSourceId } from '@debatekit/shared';

import type { CitableSource } from '@/types/citations';

export type DataSourceResult = {
  formattedPrompt: string;
  citableSources?: CitableSource[];
};

/** Env bindings subset for domain source API keys */
export type DomainSourceEnv = {
  FINNHUB_API_KEY?: string;
  FRED_API_KEY?: string;
};

export type DataSourceFetcher = (
  userMessage: string,
  config?: Record<string, string>,
  env?: DomainSourceEnv,
) => Promise<DataSourceResult>;

// Lazy imports to avoid loading all services upfront
const DATA_SOURCE_REGISTRY: Record<DataSourceId, () => Promise<DataSourceFetcher>> = {
  'clinical-trials': async () => {
    const { fetchClinicalTrialsData } = await import('./clinical-trials.service');
    return fetchClinicalTrialsData;
  },
  'finnhub': async () => {
    const { fetchFinnhubData } = await import('./finnhub.service');
    return fetchFinnhubData;
  },
  'fred': async () => {
    const { fetchFredData } = await import('./fred.service');
    return fetchFredData;
  },
  'sec-edgar': async () => {
    const { fetchSecEdgarData } = await import('./sec-edgar.service');
    return fetchSecEdgarData;
  },
};

/**
 * Fetch domain data from a registered source.
 * Returns null if the source ID is not registered.
 * Catches and logs errors — domain source failures are non-fatal.
 */
export async function fetchDomainSource(
  sourceId: DataSourceId,
  userMessage: string,
  config?: Record<string, string>,
  env?: DomainSourceEnv,
): Promise<DataSourceResult | null> {
  const loaderFn = DATA_SOURCE_REGISTRY[sourceId];
  if (!loaderFn) {
    return null;
  }

  try {
    const fetcher = await loaderFn();
    return await fetcher(userMessage, config, env);
  } catch (error) {
    console.error(`Domain source ${sourceId} failed:`, error);
    return null;
  }
}
