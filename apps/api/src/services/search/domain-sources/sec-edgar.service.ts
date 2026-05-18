/**
 * SEC EDGAR Data Source Service
 *
 * Fetches company filings and financial data from SEC EDGAR.
 * API: https://efts.sec.gov/LATEST/ (free, 10 req/sec)
 *
 * Flow:
 * 1. Extract company name/ticker from user message
 * 2. Search EDGAR full-text search for matching companies
 * 3. Fetch XBRL financial facts for structured data
 * 4. Format as markdown context for LLM consumption
 */

import { z } from 'zod';

import type { CitableSource } from '@/types/citations';

import type { DataSourceResult } from './registry';

const EDGAR_BASE = 'https://efts.sec.gov/LATEST';
const EDGAR_COMPANY_FACTS = 'https://data.sec.gov/api/xbrl/companyfacts';
const EDGAR_USER_AGENT = 'DebateKit AI research@debatekit.com';

const EdgarSearchResultSchema = z.object({
  hits: z.object({
    hits: z.array(z.object({
      _id: z.string(),
      _source: z.object({
        ciks: z.array(z.string()),
        display_names: z.array(z.string()),
        file_date: z.string(),
        file_description: z.string(),
        file_num: z.array(z.string()),
        form: z.string(),
        period_ending: z.string(),
      }),
    })),
    total: z.object({ value: z.number() }),
  }),
});
type EdgarSearchResult = z.infer<typeof EdgarSearchResultSchema>;

const XbrlFactSchema = z.object({
  end: z.string(),
  filed: z.string(),
  form: z.string(),
  fp: z.string(),
  fy: z.number(),
  val: z.number(),
});
const XbrlCompanyFactsSchema = z.object({
  cik: z.number(),
  entityName: z.string(),
  facts: z.object({
    'us-gaap': z.record(z.string(), z.object({
      label: z.string(),
      units: z.record(z.string(), z.array(XbrlFactSchema)),
    })).optional(),
  }),
});
type XbrlCompanyFacts = z.infer<typeof XbrlCompanyFactsSchema>;

/**
 * Extract likely company names or tickers from user message.
 * Simple heuristic: look for capitalized words, known patterns.
 */
function extractCompanyQuery(userMessage: string): string {
  // Remove common filler words and extract the core query
  const cleaned = userMessage
    .replace(/(?:evaluate|analyze|analysis|assess|review|acquire|acquiring|acquisition|invest(?:ing|ment)?|should (?:we|i)|what about|tell me about|look at|due diligence|deal|target|company)\s*/gi, '')
    .replace(/[?.!,]/g, '')
    .trim();

  // If we have a cleaned result, use it; otherwise fall back to original
  return cleaned || userMessage.slice(0, 100);
}

/**
 * Search EDGAR for companies matching the query.
 */
async function searchEdgar(query: string): Promise<EdgarSearchResult | null> {
  const url = `${EDGAR_BASE}/search-index?q=${encodeURIComponent(query)}&dateRange=custom&startdt=${getOneYearAgo()}&forms=10-K,10-Q,8-K`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': EDGAR_USER_AGENT },
    });
    if (!res.ok) {
      return null;
    }
    return EdgarSearchResultSchema.parse(await res.json());
  } catch {
    return null;
  }
}

/**
 * Fetch XBRL structured financial data for a company by CIK.
 */
async function fetchCompanyFacts(cik: string): Promise<XbrlCompanyFacts | null> {
  const paddedCik = cik.padStart(10, '0');
  const url = `${EDGAR_COMPANY_FACTS}/CIK${paddedCik}.json`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': EDGAR_USER_AGENT },
    });
    if (!res.ok) {
      return null;
    }
    return XbrlCompanyFactsSchema.parse(await res.json());
  } catch {
    return null;
  }
}

/**
 * Parse EDGAR display_name format: "Apple Inc.  (AAPL)  (CIK 0000320193)"
 */
function parseDisplayName(displayName: string): { companyName: string; ticker: string; cik: string } {
  const tickerMatch = displayName.match(/\(([A-Z0-9.-]+)\)/);
  const cikMatch = displayName.match(/\(CIK\s+(\d+)\)/);
  const companyName = displayName.replace(/\s*\(.*$/, '').trim();
  return {
    cik: cikMatch?.[1] ?? '',
    companyName: companyName || 'Unknown',
    ticker: tickerMatch?.[1] ?? '',
  };
}

function getOneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0] ?? '';
}

function formatCurrency(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1e9) {
    return `$${(val / 1e9).toFixed(1)}B`;
  }
  if (abs >= 1e6) {
    return `$${(val / 1e6).toFixed(1)}M`;
  }
  if (abs >= 1e3) {
    return `$${(val / 1e3).toFixed(0)}K`;
  }
  return `$${val.toFixed(0)}`;
}

/**
 * Extract the most recent value for a given XBRL concept from 10-K or 10-Q filings.
 */
function getLatestFact(
  facts: XbrlCompanyFacts['facts'],
  concept: string,
): { value: number; period: string; form: string } | null {
  const conceptData = facts['us-gaap']?.[concept];
  if (!conceptData) {
    return null;
  }

  const usdFacts = conceptData.units['USD'];
  if (!usdFacts?.length) {
    return null;
  }

  // Sort by filing date descending, prefer 10-K over 10-Q
  const sorted = [...usdFacts]
    .filter(f => f.form === '10-K' || f.form === '10-Q')
    .sort((a, b) => {
      const dateCompare = b.end.localeCompare(a.end);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return a.form === '10-K' ? -1 : 1;
    });

  const latest = sorted[0];
  if (!latest) {
    return null;
  }

  return {
    form: latest.form,
    period: latest.end,
    value: latest.val,
  };
}

/**
 * Main fetch function for SEC EDGAR data source.
 */
export async function fetchSecEdgarData(
  userMessage: string,
  _config?: Record<string, string>,
  _env?: import('./registry').DomainSourceEnv,
): Promise<DataSourceResult> {
  const query = extractCompanyQuery(userMessage);
  const searchResults = await searchEdgar(query);

  if (!searchResults?.hits?.hits?.length) {
    return {
      formattedPrompt: `\n\n## SEC EDGAR Data\nNo SEC filings found for "${query}". The company may be private or the search terms may need adjustment.`,
    };
  }

  // Get the first matching company
  const topHit = searchResults.hits.hits[0];
  if (!topHit) {
    return { formattedPrompt: '' };
  }
  const displayName = topHit._source.display_names?.[0] ?? '';
  const parsed = parseDisplayName(displayName);
  const companyName = parsed.companyName;
  const ticker = parsed.ticker || 'N/A';
  const cik = parsed.cik || topHit._source.ciks?.[0]?.replace(/^0+/, '') || '';

  // Fetch XBRL financial data
  const companyFacts = await fetchCompanyFacts(cik);

  // Build recent filings list
  const recentFilings = searchResults.hits.hits.slice(0, 5);
  const filingsSection = recentFilings.map((hit) => {
    const s = hit._source;
    return `- **${s.form}** (${s.file_date}): ${s.file_description || 'Filing'} [SEC Link](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${s.form}&dateb=&owner=include&count=10)`;
  }).join('\n');

  // Build financial highlights if XBRL data available
  let financialsSection = '';
  if (companyFacts?.facts?.['us-gaap']) {
    const facts = companyFacts.facts;
    const revenue = getLatestFact(facts, 'Revenues') || getLatestFact(facts, 'RevenueFromContractWithCustomerExcludingAssessedTax');
    const netIncome = getLatestFact(facts, 'NetIncomeLoss');
    const totalAssets = getLatestFact(facts, 'Assets');
    const totalDebt = getLatestFact(facts, 'LongTermDebt') || getLatestFact(facts, 'LongTermDebtNoncurrent');
    const cash = getLatestFact(facts, 'CashAndCashEquivalentsAtCarryingValue');
    const totalEquity = getLatestFact(facts, 'StockholdersEquity');

    const metrics: string[] = [];
    if (revenue) {
      metrics.push(`- Revenue: ${formatCurrency(revenue.value)} (${revenue.form}, period ending ${revenue.period})`);
    }
    if (netIncome) {
      metrics.push(`- Net Income: ${formatCurrency(netIncome.value)} (${netIncome.form}, period ending ${netIncome.period})`);
    }
    if (totalAssets) {
      metrics.push(`- Total Assets: ${formatCurrency(totalAssets.value)}`);
    }
    if (totalDebt) {
      metrics.push(`- Long-Term Debt: ${formatCurrency(totalDebt.value)}`);
    }
    if (cash) {
      metrics.push(`- Cash & Equivalents: ${formatCurrency(cash.value)}`);
    }
    if (totalEquity) {
      metrics.push(`- Stockholders' Equity: ${formatCurrency(totalEquity.value)}`);
    }

    if (metrics.length > 0) {
      financialsSection = `\n### Financial Highlights\n${metrics.join('\n')}`;
    }
  }

  const edgarUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=&dateb=&owner=include&count=40`;
  const citableSources: CitableSource[] = [{
    content: financialsSection || `SEC filings for ${companyName} (${ticker}), CIK ${cik}`,
    id: `dom_sec_${ticker || cik}`,
    metadata: {
      description: `SEC EDGAR filings and financial data for ${companyName}`,
      domain: 'sec.gov',
      query,
      url: edgarUrl,
    },
    sourceId: `sec-edgar-${cik}`,
    title: `SEC EDGAR: ${companyName} (${ticker})`,
    type: 'domain',
  }];

  const formattedPrompt = `

## SEC EDGAR: ${companyName}
**CIK**: ${cik} | **Ticker**: ${ticker}
${financialsSection}

### Recent SEC Filings
${filingsSection}

*Data sourced from SEC EDGAR (${new Date().toISOString().split('T')[0]}). All figures from company filings — verify independently for investment decisions.*`;

  return { citableSources, formattedPrompt };
}
