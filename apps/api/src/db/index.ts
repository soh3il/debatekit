// Import shared tables from @debatekit/db
import * as dbTables from '@debatekit/db/tables';
import { NodeEnvs } from '@debatekit/shared';
import { env as workersEnv } from 'cloudflare:workers';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';

import { CloudflareKVCache } from './cache/cloudflare-kv-cache';
// Import API-only tables
import * as activeStream from './tables/active-stream';
import * as adminSettings from './tables/admin-settings';
import * as billing from './tables/billing';
import * as conversationMessages from './tables/conversation-messages';
import * as deletedAccountAudit from './tables/deleted-account-audit';
import * as email from './tables/email';
import * as job from './tables/job';
import * as pipeline from './tables/pipeline';
import * as project from './tables/project';
// Import API relations (full set, overrides shared ones)
import * as relations from './tables/relations';
import * as tweet from './tables/tweet';
import * as upload from './tables/upload';
import * as usage from './tables/usage';
import * as workingMemory from './tables/working-memory';

// Combine all schemas for Drizzle (includes relations for type inference)
const schema = {
  ...dbTables,
  ...activeStream,
  ...adminSettings,
  ...billing,
  ...conversationMessages,
  ...deletedAccountAudit,
  ...email,
  ...job,
  ...pipeline,
  ...project,
  // Relations MUST come after tables to override shared relation definitions
  ...relations,
  ...tweet,
  ...upload,
  ...usage,
  ...workingMemory,
};

// Database configuration - path is computed lazily in getLocalDbPath()
const LOCAL_DB_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';

/**
 * Gets the path to the local SQLite database file (async to lazy load Node.js modules)
 * Creates the directory if it doesn't exist and returns the path to the database file
 */
async function getLocalDbPath(): Promise<string> {
  // Lazy load Node.js modules - only used in local development
  const fs = await import('node:fs');
  const path = await import('node:path');

  const LOCAL_DB_PATH = path.join(process.cwd(), LOCAL_DB_DIR);

  // Create directory if it doesn't exist
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.mkdirSync(LOCAL_DB_PATH, { recursive: true });
  }

  // Look for existing SQLite file (prioritize wrangler-generated files)
  try {
    const files = fs.readdirSync(LOCAL_DB_PATH);
    const dbFile = files.find(file => file.endsWith('.sqlite'));
    if (dbFile) {
      const fullPath = path.join(LOCAL_DB_PATH, dbFile);
      return fullPath;
    }
  } catch {
  }

  // Return default path
  const defaultPath = path.join(LOCAL_DB_PATH, 'database.sqlite');
  return defaultPath;
}

/**
 * Initialize local SQLite database connection for development with performance optimizations
 * Async to lazy load Node.js-only modules (better-sqlite3, drizzle-orm/better-sqlite3)
 */
async function initLocalDb() {
  // Lazy load Node.js modules - only used in local development
  const fs = await import('node:fs');
  const { default: Database } = await import('better-sqlite3');
  const { drizzle: drizzleBetter } = await import('drizzle-orm/better-sqlite3');

  const dbPath = await getLocalDbPath();

  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Local database not found at ${dbPath}. Run 'bun run db:migrate:local' to create it.`,
    );
  }

  const sqlite = new Database(dbPath);

  // Performance optimizations for SQLite
  sqlite.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
  sqlite.pragma('synchronous = NORMAL'); // Balance between safety and performance
  sqlite.pragma('cache_size = -2000'); // 2MB cache size (negative = pages)
  sqlite.pragma('foreign_keys = ON'); // Enable foreign key constraints
  sqlite.pragma('temp_store = MEMORY'); // Store temporary tables in memory
  sqlite.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O

  const db = drizzleBetter(sqlite, {
    logger: process.env.NODE_ENV === NodeEnvs.DEVELOPMENT,
    schema,
  });

  return db;
}

/**
 * Get D1 database binding from Cloudflare Workers env
 */
function getD1Binding(): D1Database | null {
  try {
    return workersEnv.DB || null;
  } catch {
    return null;
  }
}

/**
 * Get KV namespace binding from Cloudflare Workers env
 */
function getKVBinding(): KVNamespace | null {
  try {
    return workersEnv.KV || null;
  } catch {
    return null;
  }
}

/**
 * Get database instance for Cloudflare Workers
 *
 * ⚠️ CLOUDFLARE D1 NOTE: Use batch operations, not transactions.
 */
export function getDb() {
  return createDbInstance();
}

/**
 * Async version of getDb - uses async initialization for local SQLite
 */
export async function getDbAsync() {
  return await createDbInstanceAsync();
}

/**
 * Type guard for checking if caches object has default property
 */
function hasCachesDefault(obj: unknown): obj is { default: unknown } {
  return typeof obj === 'object' && obj !== null && 'default' in obj;
}

/**
 * Detect if running in Cloudflare Workers environment (not Node.js)
 */
function isCloudflareWorkersRuntime(): boolean {
  if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Cloudflare-Workers')) {
    return true;
  }
  if (typeof caches !== 'undefined' && hasCachesDefault(caches)) {
    return true;
  }
  return false;
}

// Type for local SQLite database instance (used for type inference)
type LocalDbInstance = Awaited<ReturnType<typeof initLocalDb>>;
type D1DbInstance = ReturnType<typeof drizzleD1<typeof schema>>;
type DbInstance = D1DbInstance | LocalDbInstance;

/**
 * Create D1 database instance for Cloudflare Workers (synchronous)
 */
function createD1Instance(): D1DbInstance {
  const d1Database = getD1Binding();
  if (!d1Database) {
    throw new Error(
      'D1 database binding not available in Cloudflare Workers. '
      + 'Ensure DB binding is configured in wrangler.jsonc',
    );
  }

  const kvBinding = getKVBinding();
  const kvCache = kvBinding
    ? new CloudflareKVCache({
        defaultTtl: 300,
        global: false,
        kv: kvBinding,
      })
    : undefined;

  const config = {
    logger: false,
    schema,
  };
  if (kvCache !== undefined) {
    return drizzleD1(d1Database, { ...config, cache: kvCache });
  }
  return drizzleD1(d1Database, config);
}

/**
 * Create database instance for the global db Proxy
 */
function createDbInstance(): DbInstance {
  if (isCloudflareWorkersRuntime()) {
    return createD1Instance();
  }

  const d1Database = getD1Binding();
  if (d1Database) {
    const kvBinding = getKVBinding();
    const kvCache = kvBinding
      ? new CloudflareKVCache({
          defaultTtl: 300,
          global: false,
          kv: kvBinding,
        })
      : undefined;

    const config = {
      logger: process.env.NODE_ENV !== 'production',
      schema,
    };
    if (kvCache !== undefined) {
      return drizzleD1(d1Database, { ...config, cache: kvCache });
    }
    return drizzleD1(d1Database, config);
  }

  throw new Error('Local SQLite requires async initialization. Use getDbAsync() instead.');
}

/**
 * Create database instance asynchronously (for local development)
 */
async function createDbInstanceAsync(): Promise<DbInstance> {
  if (isCloudflareWorkersRuntime()) {
    return createD1Instance();
  }

  const d1Database = getD1Binding();
  if (d1Database) {
    const kvBinding = getKVBinding();
    const kvCache = kvBinding
      ? new CloudflareKVCache({
          defaultTtl: 300,
          global: false,
          kv: kvBinding,
        })
      : undefined;

    const config = {
      logger: process.env.NODE_ENV !== NodeEnvs.PRODUCTION,
      schema,
    };
    if (kvCache !== undefined) {
      return drizzleD1(d1Database, { ...config, cache: kvCache });
    }
    return drizzleD1(d1Database, config);
  }

  return await initLocalDb();
}

let _cachedLocalDbInstance: ReturnType<typeof createDbInstance> | null = null;

function getCachedDbInstance(): ReturnType<typeof createDbInstance> {
  if (isCloudflareWorkersRuntime()) {
    return createDbInstance();
  }

  if (!_cachedLocalDbInstance) {
    _cachedLocalDbInstance = createDbInstance();
  }
  return _cachedLocalDbInstance;
}

/**
 * Global database Proxy for Better Auth compatibility
 */
export const db = new Proxy({} as ReturnType<typeof createDbInstance>, {
  get(_, prop) {
    const dbInstance = getCachedDbInstance();
    const value = dbInstance[prop as keyof typeof dbInstance];

    if (typeof value === 'function') {
      return value.bind(dbInstance);
    }

    return value;
  },
});

// Database type for prepared queries
export type DbType = typeof db;

/**
 * Type alias for the async database instance.
 *
 * Used in explicit type annotations on Zod schema `const` declarations
 * to prevent TS7056 "inferred type exceeds maximum length" errors.
 *
 * The Drizzle type graph is enormous when the full schema (all tables +
 * relations) is included. Without an explicit annotation, TypeScript
 * tries to serialize the deeply-nested ZodObject generic which embeds
 * the DB type multiple times. By annotating with `z.ZodType<{ db: AppDb, ... }>`
 * the compiler emits the alias name rather than expanding it.
 */
export type AppDb = Awaited<ReturnType<typeof getDbAsync>>;

// Export schema for Better Auth CLI compatibility
export { schema };

// Export KV binding getter for services that need direct KV access
export { getKVBinding };

// Export batch-related types for TypeScript enforcement
export type { BatchableOperation, BatchResults, D1BatchDatabase } from './d1-types';

// Re-export all schemas (Zod metadata schemas - single source of truth)
export * from './schemas';

// Re-export all table definitions via barrel (single source of truth)
export * from './tables';
