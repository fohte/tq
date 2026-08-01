import { TransactionRollbackError } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, aroundEach, expect } from 'vitest'
import { z, type ZodType } from 'zod'

import { app } from '#app'
import { runWithDb } from '#db/connection'
import * as schema from '#db/schema'
import { DATABASE_URL } from '#env'

// Single connection so the transaction below and every query issued during
// a test run on the same underlying Postgres session.
const testClient = postgres(DATABASE_URL, { max: 1 })
const testDb = drizzle(testClient, { schema })

export function setupTestDb() {
  // Transaction strategy: wrap each test in a real transaction and roll it
  // back afterward. `runWithDb` binds the `tx` handed to the transaction
  // callback to `runTest`'s async execution context, so the `db` export (see
  // #db/connection) resolves to it for the whole test body without touching
  // any state shared with other test files running in parallel. A nested
  // db.transaction() call in application code then becomes a SAVEPOINT
  // instead of committing the outer test transaction early.
  //
  // This must be `aroundEach`, not a beforeEach/afterEach pair:
  // AsyncLocalStorage's context only propagates through the synchronous
  // continuation of where it was entered, so a `tx` bound in beforeEach never
  // reaches the test body once an `await` separates them. `aroundEach` calls
  // `runTest` directly inside this callback, keeping the test body within
  // the same continuation as `runWithDb`.
  aroundEach(async (runTest) => {
    await testDb
      .transaction(async (tx) => {
        await runWithDb(tx, () => runTest())
        tx.rollback()
      })
      .catch((error: unknown) => {
        if (error instanceof TransactionRollbackError) {
          return undefined
        }
        return Promise.reject(
          error instanceof Error ? error : new Error(String(error)),
        )
      })
  })

  afterAll(async () => {
    await testClient.end()
  })
}

/**
 * Create a Zod passthrough schema typed as T.
 * Accepts any value at runtime but narrows to T at the type level,
 * avoiding explicit type assertions while keeping call sites concise.
 */
export function passthroughSchema<T>(): ZodType<T> {
  return z.any()
}

/**
 * Parse a JSON response body with Zod runtime validation.
 * The schema validates and narrows the unknown response to T without
 * requiring an unsafe type assertion.
 *
 * For call sites where a full schema is impractical, use
 * `passthroughSchema<T>()` which accepts any value but preserves the type.
 */
export async function jsonBody<T>(
  res: Response,
  schema: ZodType<T> = passthroughSchema<T>(),
): Promise<T> {
  const data: unknown = await res.json()
  return schema.parse(data)
}

/**
 * Assert that a value is defined (not null/undefined), narrowing its type.
 * Replaces non-null assertions (`!`) in tests with a proper Vitest assertion
 * that produces clear error messages on failure.
 */
export function assertDefined<T>(
  value: T | null | undefined,
  msg?: string,
): asserts value is T {
  expect(value, msg ?? 'Expected value to be defined').not.toBeNull()
  expect(value, msg ?? 'Expected value to be defined').toBeDefined()
}

/**
 * Create a File with deterministic (zero-filled) content of the given size,
 * for tests exercising upload validation without needing real image bytes.
 */
export function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([Buffer.alloc(sizeBytes)], name, { type })
}

/**
 * PATCH /api/scheduling-settings, returning the raw response so callers can
 * assert on failures instead of having them pass silently.
 */
export function patchSchedulingSettings(body: Record<string, unknown>) {
  return app.request('/api/scheduling-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
