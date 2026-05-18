import { listAccessibleCustomers } from '../google-ads-client.js';

export async function handleListCustomers(): Promise<string> {
  const result = await listAccessibleCustomers();
  return JSON.stringify(result, null, 2);
}
