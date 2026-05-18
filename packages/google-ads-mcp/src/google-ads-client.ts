import type {
  GoogleAdsHeaders,
  KeywordIdeasBody,
  MutateOperation,
  TokenCache,
} from './schemas.js';
import {
  AccessibleCustomersResponseSchema,
  KeywordIdeasResponseSchema,
  MutateResponseSchema,
  SearchStreamResponseSchema,
  TokenResponseSchema,
} from './schemas.js';

const API_VERSION = 'v20';
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let tokenCache: TokenCache | null = null;

function getEnv(key: string, required = true): string {
  const value = process.env[key] ?? '';
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getCustomerId(override?: string): string {
  const id = override ?? getEnv('GOOGLE_ADS_CUSTOMER_ID');
  return id.replace(/-/g, '');
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getEnv('GOOGLE_ADS_CLIENT_ID'),
      client_secret: getEnv('GOOGLE_ADS_CLIENT_SECRET'),
      refresh_token: getEnv('GOOGLE_ADS_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${error}`);
  }

  const data = TokenResponseSchema.parse(await response.json());
  const newToken: TokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  // eslint-disable-next-line require-atomic-updates -- intentional cache update; race is benign
  tokenCache = newToken;

  return newToken.accessToken;
}

function getHeaders(accessToken: string): GoogleAdsHeaders {
  const headers: GoogleAdsHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'developer-token': getEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
  };

  const loginCustomerId = getEnv('GOOGLE_ADS_LOGIN_CUSTOMER_ID', false);
  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId.replace(/-/g, '');
  }

  return headers;
}

export async function searchGaql(
  customerId: string,
  query: string,
): Promise<Array<Record<string, unknown>>> {
  const accessToken = await getAccessToken();
  const url = `${BASE_URL}/customers/${customerId}/googleAds:searchStream`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(accessToken),
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GAQL search failed: ${response.status} ${error}`);
  }

  const data = SearchStreamResponseSchema.parse(await response.json());
  return data.flatMap(batch => batch.results ?? []);
}

export async function mutate(
  customerId: string,
  entityType: string,
  operations: MutateOperation[],
) {
  const accessToken = await getAccessToken();
  const url = `${BASE_URL}/customers/${customerId}/${entityType}:mutate`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(accessToken),
    body: JSON.stringify({ operations }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mutate ${entityType} failed: ${response.status} ${error}`);
  }

  return MutateResponseSchema.parse(await response.json());
}

export async function listAccessibleCustomers() {
  const accessToken = await getAccessToken();
  const url = `${BASE_URL}/customers:listAccessibleCustomers`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(accessToken),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`List customers failed: ${response.status} ${error}`);
  }

  return AccessibleCustomersResponseSchema.parse(await response.json());
}

export async function generateKeywordIdeas(
  customerId: string,
  body: KeywordIdeasBody,
) {
  const accessToken = await getAccessToken();
  const url = `${BASE_URL}/customers/${customerId}:generateKeywordIdeas`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(accessToken),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Keyword ideas failed: ${response.status} ${error}`);
  }

  return KeywordIdeasResponseSchema.parse(await response.json());
}
