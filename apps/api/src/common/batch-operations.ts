/**
 * Batch Operations Utility - Cloudflare D1 Best Practices
 *
 * Reusable helper for atomic batch operations following Drizzle ORM patterns.
 * Provides a consistent interface for D1's batch() API with fallback for local SQLite.
 *
 * ⚠️ CRITICAL: Cloudflare D1 does NOT support transactions. Use batch operations instead.
 *
 * Key Features:
 * - Type-safe batch execution following Drizzle ORM patterns
 * - Automatic fallback to sequential execution for local SQLite (Better-SQLite3)
 * - Proper error handling and logging
 * - Zero overhead abstraction - compiles to direct db.batch() calls
 *
 * Official Drizzle ORM Batch API Pattern:
 * @see https://orm.drizzle.team/docs/batch-api
 * @see https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#batch-statements
 *
 * @example Basic Usage
 * ```typescript
 * import { executeBatch } from '@/common/batch-operations';
 * import { getDbAsync } from '@/db';
 *
 * const db = await getDbAsync();
 *
 * await executeBatch(db, [
 *   db.insert(users).values({ name: 'John' }),
 *   db.update(users).set({ verified: true }).where(eq(users.id, 1))
 * ]);
 * ```
 *
 * @example With Returning Values
 * ```typescript
 * const [insertResult, updateResult] = await executeBatch(db, [
 *   db.insert(users).values({ name: 'John' }).returning(),
 *   db.update(users).set({ verified: true }).where(eq(users.id, 1))
 * ]);
 * ```
 *
 * @example Rollover with History Archive
 * ```typescript
 * const historyInsert = db.insert(usageHistory).values(snapshot);
 * const usageUpdate = db.update(usage).set({ count: 0 }).where(eq(usage.userId, id));
 *
 * await executeBatch(db, [historyInsert, usageUpdate]);
 * ```
 */

import type { BatchItem } from 'drizzle-orm/batch';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { z } from 'zod';

import { createError } from '@/common/error-handling';

/**
 * Type alias for any Drizzle query builder that can be batched
 *
 * Drizzle's BatchItem is the official type for batch operations.
 * We use any[] as a practical type since D1 batch accepts heterogeneous query types.
 *
 * Following official Drizzle pattern:
 * @see https://orm.drizzle.team/docs/batch-api
 */
type BatchQuery = BatchItem<'sqlite'>;

/**
 * Interface for Drizzle query builders that can be executed directly
 *
 * All Drizzle query builders (insert/update/delete/select) extend QueryPromise
 * which implements this interface. BatchItem<'sqlite'> is typed as RunnableQuery
 * which doesn't expose execute() in the public API, but all concrete query builders
 * extend QueryPromise which provides the execute() method.
 *
 * @see https://orm.drizzle.team/docs/batch-api
 * @see drizzle-orm/query-promise.d.ts - QueryPromise abstract class
 */
type ExecutableQuery = {
  execute: () => Promise<unknown>;
};

/**
 * Type guard to check if an operation has an execute() method
 *
 * This validates at runtime that the operation is an executable Drizzle query.
 * All Drizzle query builders (insert/update/delete/select) extend QueryPromise
 * which provides the execute() method, even though BatchItem type doesn't expose it.
 *
 * @param operation - The operation to check
 * @returns True if the operation has an execute method
 */
/**
 * Zod schema for validating that an operation has an execute() method.
 * Used instead of manual type guard with `as` casting.
 */
const ExecutableQuerySchema = z.object({
  execute: z.function(),
});

function isExecutableQuery(operation: unknown): operation is ExecutableQuery {
  return ExecutableQuerySchema.safeParse(operation).success;
}

/**
 * Drizzle database instance that supports batch operations
 *
 * TYPE SAFETY NOTE:
 * - Accepts both D1 and Better-SQLite3 database types
 * - Schema type parameter allows type-safe schema access
 * - $client property is typed as `unknown` since we only need the batch() method
 * - This union type represents all valid database configurations from getDbAsync()
 *
 * LIBRARY CONSTRAINT - Record<string, unknown> justified:
 * Drizzle ORM defines its internal DbSchema type as Record<string, unknown>.
 * DrizzleD1Database<TSchema> and BetterSQLite3Database<TSchema> both require
 * TSchema extends Record<string, unknown>. This constraint is imposed by the
 * Drizzle ORM type system and cannot be narrowed without breaking compatibility.
 *
 * @see drizzle-orm/d1/driver.d.ts - DrizzleD1Database generic constraint
 * @see drizzle-orm/better-sqlite3/driver.d.ts - BetterSQLite3Database generic constraint
 */
type BatchCapableDatabase<TSchema extends Record<string, unknown> = Record<string, unknown>>
  = | DrizzleD1Database<TSchema>
    | BetterSQLite3Database<TSchema>
    | (DrizzleD1Database<TSchema> & { $client: unknown })
    | (BetterSQLite3Database<TSchema> & { $client: unknown });

/**
 * Execute multiple Drizzle ORM queries atomically using D1's batch API
 *
 * ✅ ATOMIC: All operations succeed together or fail together
 * ✅ TYPE-SAFE: Full TypeScript inference for query results
 * ✅ FALLBACK: Automatic sequential execution for local SQLite development
 *
 * Implementation follows official Drizzle ORM batch patterns:
 * - Uses db.batch() for Cloudflare D1 (runtime check)
 * - Falls back to sequential execution for Better-SQLite3 (local dev)
 * - Preserves type safety through generic return type inference
 *
 * @param db - Drizzle database instance (from getDbAsync())
 * @param operations - Array of Drizzle query builders to execute atomically
 * @returns Promise resolving to array of results matching input operation types
 *
 * @throws {Error} If any operation fails (all operations rolled back automatically)
 *
 * @example Archive + Update Pattern
 * ```typescript
 * // ✅ GOOD: Related operations that must be atomic
 * await executeBatch(db, [
 *   db.insert(history).values(snapshot),  // Archive old data
 *   db.update(current).set({ count: 0 }) // Reset current data
 * ]);
 * ```
 *
 * @example Multiple Inserts Pattern
 * ```typescript
 * // ✅ GOOD: Multiple related inserts
 * await executeBatch(db, [
 *   db.insert(customers).values(customer),
 *   db.insert(subscriptions).values(subscription),
 *   db.insert(invoices).values(invoice)
 * ]);
 * ```
 *
 * @example Upsert Pattern
 * ```typescript
 * // ✅ GOOD: Insert with conflict resolution
 * await executeBatch(db, [
 *   db.insert(products).values(product).onConflictDoUpdate({
 *     target: products.id,
 *     set: { updatedAt: new Date() }
 *   }),
 *   db.update(inventory).set({ stock: sql`${inventory.stock} + 1` })
 * ]);
 * ```
 */
/** LIBRARY CONSTRAINT: TSchema extends Record<string, unknown> per Drizzle ORM's DbSchema type */
export async function executeBatch<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
  T extends BatchQuery[] = BatchQuery[],
>(
  db: BatchCapableDatabase<TSchema>,
  operations: [...T],
): Promise<unknown[]> {
  if (operations.length === 0) {
    return [];
  }

  // ✅ CLOUDFLARE D1: Use native batch API for atomic execution
  // Runtime check ensures this works in production (Cloudflare Workers)
  if ('batch' in db && typeof db.batch === 'function') {
    /**
     * Type assertion for batch() method call
     *
     * JUSTIFICATION:
     * - Drizzle ORM batch() signature: (queries: BatchItem<'sqlite'>[]) => Promise<unknown[]>
     * - Runtime check ('batch' in db) guarantees method exists before calling
     * - Type system cannot infer method signature from discriminated union at this point
     * - Safe because:
     *   1. operations is BatchQuery[] which is BatchItem<'sqlite'>[]
     *   2. batch() returns Promise<unknown[]> matching our return type
     *   3. This is the official Drizzle ORM pattern for D1
     *
     * ALTERNATIVE CONSIDERED: Custom type guard would add complexity without safety benefit
     * REFERENCE: https://orm.drizzle.team/docs/batch-api
     */
    const results = await (db.batch as (queries: BatchQuery[]) => Promise<unknown[]>)(operations);
    return results;
  }

  // ✅ LOCAL DEVELOPMENT: Sequential execution fallback for Better-SQLite3
  // Better-SQLite3 doesn't support batch(), but sequential execution is acceptable for dev
  const results: unknown[] = [];
  for (const operation of operations) {
    /**
     * Type-safe execution using type guard
     *
     * All Drizzle query builders (insert/update/delete/select) extend QueryPromise
     * which provides the execute() method. The isExecutableQuery type guard validates
     * this at runtime before calling execute().
     *
     * This fallback only runs in local dev with Better-SQLite3 (not production D1).
     * Production uses db.batch() path which has proper type support.
     *
     * @see https://orm.drizzle.team/docs/batch-api
     */
    if (!isExecutableQuery(operation)) {
      throw createError.internal(
        'Batch operation is not executable - expected a Drizzle query builder',
        {
          errorType: 'database',
          operation: 'batch',
        },
      );
    }
    const result = await operation.execute();
    results.push(result);
  }

  return results;
}

/**
 * Validate batch size limits
 *
 * Cloudflare D1 has limits on batch size (typically 100 operations).
 * This utility helps ensure batches stay within limits.
 *
 * @param operationCount - Number of operations to validate
 * @param maxBatchSize - Maximum allowed batch size (default: 100)
 * @throws {Error} If operation count exceeds maximum
 *
 * @example
 * ```typescript
 * const operations = [
 *   // ... many operations
 * ];
 *
 * validateBatchSize(operations.length);
 * await executeBatch(db, operations);
 * ```
 */
export function validateBatchSize(operationCount: number, maxBatchSize = 100): void {
  if (operationCount > maxBatchSize) {
    throw createError.badRequest(
      `Batch size limit exceeded: ${operationCount} operations (max: ${maxBatchSize}). `
      + `Consider splitting into multiple batches or refactoring logic.`,
      {
        errorType: 'validation',
        schemaName: 'BatchOperations',
      },
    );
  }
}
