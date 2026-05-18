/**
 * Finnhub Data Source Service
 *
 * Fetches market data, M&A events, insider transactions, and ESG data.
 * API: https://finnhub.io/docs/api (free tier: 60 req/min)
 *
 * Flow:
 * 1. Extract company ticker/name from user message
 * 2. Lookup symbol if needed
 * 3. Fetch company profile + insider transactions + ESG
 * 4. Format as markdown context with citation IDs
 */

import { z } from 'zod';

import type { CitableSource } from '@/types/citations';

import type { DataSourceResult, DomainSourceEnv } from './registry';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

const FinnhubCompanyProfileSchema = z.object({
  country: z.string(),
  currency: z.string(),
  exchange: z.string(),
  finnhubIndustry: z.string(),
  ipo: z.string(),
  logo: z.string(),
  marketCapitalization: z.number(),
  name: z.string(),
  shareOutstanding: z.number(),
  ticker: z.string(),
  weburl: z.string(),
});
type FinnhubCompanyProfile = z.infer<typeof FinnhubCompanyProfileSchema>;

const FinnhubSymbolLookupSchema = z.object({
  result: z.array(z.object({
    description: z.string(),
    displaySymbol: z.string(),
    symbol: z.string(),
    type: z.string(),
  })),
});

const FinnhubInsiderTransactionSchema = z.object({
  change: z.number(),
  filingDate: z.string(),
  name: z.string(),
  share: z.number(),
  symbol: z.string(),
  transactionCode: z.string(),
  transactionPrice: z.number(),
});
type FinnhubInsiderTransaction = z.infer<typeof FinnhubInsiderTransactionSchema>;

const FinnhubInsiderResultSchema = z.object({
  data: z.array(FinnhubInsiderTransactionSchema),
  symbol: z.string(),
});

const FinnhubQuoteSchema = z.object({
  c: z.number(), // current
  d: z.number(), // change
  dp: z.number(), // percent change
  h: z.number(), // high
  l: z.number(), // low
  o: z.number(), // open
  pc: z.number(), // previous close
  t: z.number(), // timestamp
});
type FinnhubQuote = z.infer<typeof FinnhubQuoteSchema>;

/**
 * Extract ticker symbol from user message.
 */
function extractTickerQuery(userMessage: string): string {
  // Check for explicit ticker pattern (1-5 uppercase letters)
  const tickerMatch = userMessage.match(/\b([A-Z]{1,5})\b/);

  const cleaned = userMessage
    .replace(/(?:evaluate|analyze|analysis|assess|review|acquire|acquiring|acquisition|invest(?:ing|ment)?|should (?:we|i)|what about|tell me about|look at|due diligence|deal|target|company|stock|shares?|price|quote)\s*/gi, '')
    .replace(/[?.!,]/g, '')
    .trim();

  // Prefer explicit ticker if found, otherwise use cleaned query
  return tickerMatch?.[1] ?? (cleaned || userMessage.slice(0, 50));
}

/**
 * Lookup a symbol from company name.
 */
async function lookupSymbol(query: string, apiKey: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: query,
    token: apiKey,
  });

  try {
    const res = await fetch(`${FINNHUB_BASE}/search?${params}`);
    if (!res.ok) {
      return null;
    }
    const data = FinnhubSymbolLookupSchema.parse(await res.json());
    // Prefer US equities
    const usResult = data.result?.find(r => r.type === 'Common Stock' && !r.symbol.includes('.'));
    return usResult?.symbol ?? data.result?.[0]?.symbol ?? null;
  } catch {
    return null;
  }
}

async function fetchCompanyProfile(symbol: string, apiKey: string): Promise<FinnhubCompanyProfile | null> {
  const params = new URLSearchParams({
    symbol,
    token: apiKey,
  });

  try {
    const res = await fetch(`${FINNHUB_BASE}/stock/profile2?${params}`);
    if (!res.ok) {
      return null;
    }
    const data = FinnhubCompanyProfileSchema.parse(await res.json());
    return data.name ? data : null;
  } catch {
    return null;
  }
}

async function fetchQuote(symbol: string, apiKey: string): Promise<FinnhubQuote | null> {
  const params = new URLSearchParams({
    symbol,
    token: apiKey,
  });

  try {
    const res = await fetch(`${FINNHUB_BASE}/quote?${params}`);
    if (!res.ok) {
      return null;
    }
    return FinnhubQuoteSchema.parse(await res.json());
  } catch {
    return null;
  }
}

async function fetchInsiderTransactions(symbol: string, apiKey: string): Promise<FinnhubInsiderTransaction[]> {
  const params = new URLSearchParams({
    symbol,
    token: apiKey,
  });

  try {
    const res = await fetch(`${FINNHUB_BASE}/stock/insider-transactions?${params}`);
    if (!res.ok) {
      return [];
    }
    const data = FinnhubInsiderResultSchema.parse(await res.json());
    return data.data?.slice(0, 5) ?? [];
  } catch {
    return [];
  }
}

function formatMarketCap(mcap: number): string {
  if (mcap >= 1e6) {
    return `$${(mcap / 1e3).toFixed(1)}B`;
  }
  if (mcap >= 1e3) {
    return `$${mcap.toFixed(0)}M`;
  }
  return `$${mcap.toFixed(1)}M`;
}

const TRANSACTION_CODES: Record<string, string> = {
  A: 'Grant/Award',
  D: 'Disposition (Sale)',
  F: 'Tax Withholding',
  M: 'Exercise/Conversion',
  P: 'Purchase',
  S: 'Sale',
};

/**
 * Main fetch function for Finnhub data source.
 */
export async function fetchFinnhubData(
  userMessage: string,
  _config?: Record<string, string>,
  env?: DomainSourceEnv,
): Promise<DataSourceResult> {
  const apiKey = env?.FINNHUB_API_KEY || '';
  if (!apiKey) {
    return {
      formattedPrompt: '\n\n## Finnhub Market Data\nFinnhub API key not configured. Set FINNHUB_API_KEY environment variable.',
    };
  }

  const query = extractTickerQuery(userMessage);

  // Check if query looks like a ticker already (all caps, 1-5 chars)
  const isTickerLike = /^[A-Z]{1,5}$/.test(query);
  const symbol = isTickerLike ? query : await lookupSymbol(query, apiKey);

  if (!symbol) {
    return {
      formattedPrompt: `\n\n## Finnhub Market Data\nNo matching symbol found for "${query}". Try using a specific ticker symbol (e.g., AAPL, MSFT, GOOGL).`,
    };
  }

  // Fetch profile, quote, and insider data in parallel
  const [profile, quote, insiders] = await Promise.all([
    fetchCompanyProfile(symbol, apiKey),
    fetchQuote(symbol, apiKey),
    fetchInsiderTransactions(symbol, apiKey),
  ]);

  if (!profile && !quote) {
    return {
      formattedPrompt: `\n\n## Finnhub Market Data\nNo data available for symbol "${symbol}". It may be delisted or not covered.`,
    };
  }

  const citableSources: CitableSource[] = [];
  const sections: string[] = [];

  // Company Profile section
  if (profile) {
    const finnhubUrl = `https://finnhub.io/stock/${symbol}`;
    citableSources.push({
      content: `${profile.name} (${symbol}) — ${profile.finnhubIndustry}, Market Cap: ${formatMarketCap(profile.marketCapitalization)}`,
      id: `dom_fh_${symbol.toLowerCase()}`,
      metadata: {
        description: `Finnhub company data for ${profile.name}`,
        domain: 'finnhub.io',
        query,
        url: finnhubUrl,
      },
      sourceId: `finnhub-${symbol}`,
      title: `Finnhub: ${profile.name} (${symbol})`,
      type: 'domain',
    });

    sections.push(`**${profile.name}** (${symbol})
Exchange: ${profile.exchange} | Industry: ${profile.finnhubIndustry}
Market Cap: ${formatMarketCap(profile.marketCapitalization)} | IPO: ${profile.ipo}
Website: ${profile.weburl}`);
  }

  // Quote section
  if (quote && quote.c > 0) {
    const changeSign = quote.d >= 0 ? '+' : '';
    sections.push(`### Current Quote
Price: $${quote.c.toFixed(2)} (${changeSign}${quote.d?.toFixed(2)} / ${changeSign}${quote.dp?.toFixed(2)}%)
Day Range: $${quote.l?.toFixed(2)} – $${quote.h?.toFixed(2)} | Prev Close: $${quote.pc?.toFixed(2)}`);
  }

  // Insider transactions section
  if (insiders.length > 0) {
    const insiderLines = insiders.map((txn) => {
      const type = TRANSACTION_CODES[txn.transactionCode] ?? txn.transactionCode;
      const shares = Math.abs(txn.change).toLocaleString();
      const price = txn.transactionPrice > 0 ? ` @ $${txn.transactionPrice.toFixed(2)}` : '';
      return `  - ${txn.filingDate}: **${txn.name}** — ${type} ${shares} shares${price}`;
    });
    sections.push(`### Recent Insider Transactions\n${insiderLines.join('\n')}`);
  }

  const companyName = profile?.name ?? symbol;
  const formattedPrompt = `

## Finnhub: ${companyName}

${sections.join('\n\n')}

*Data from Finnhub (${new Date().toISOString().split('T')[0]}). Market data may be delayed. Not investment advice — verify independently.*`;

  return { citableSources, formattedPrompt };
}
