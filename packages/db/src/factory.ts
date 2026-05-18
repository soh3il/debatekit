import { drizzle } from 'drizzle-orm/d1';

import * as schema from './tables';

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DbInstance = ReturnType<typeof createDb>;
