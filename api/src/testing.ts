import { TransactionRollbackError } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, afterEach, beforeEach, expect } from 'vitest'
import { z, type ZodType } from 'zod'

import * as connection from '#db/connection'
import * as schema from '#db/schema'
import { DATABASE_URL } from '#env'

// Single connection so the transaction below and every query issued during
// a test run on the same underlying Postgres session.
const testClient = postgres(DATABASE_URL, { max: 1 })
const testDb = drizzle(testClient, { schema })

function setDb(value: unknown) {
  Object.defineProperty(connection, 'db', {
    value,
    writable: true,
    configurable: true,
  })
}

export function setupTestDb() {
  let releaseTransaction: (() => void) | undefined
  let transactionSettled: Promise<void> | undefined

  // Transaction strategy: hold a real transaction open across the whole test
  // body (via a gate promise) and roll it back afterward. The db export is
  // swapped to the `tx` handed to the transaction callback, making it a
  // PgTransaction; a nested db.transaction() call in application code then
  // becomes a SAVEPOINT instead of committing the outer test transaction
  // early.
  beforeEach(async () => {
    let markReady: () => void
    const ready = new Promise<void>((resolve) => {
      markReady = resolve
    })
    const released = new Promise<void>((resolve) => {
      releaseTransaction = resolve
    })

    transactionSettled = testDb
      .transaction(async (tx) => {
        setDb(tx)
        markReady()
        await released
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

    await ready
  })

  afterEach(async () => {
    releaseTransaction?.()
    await transactionSettled
    setDb(testDb)
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
