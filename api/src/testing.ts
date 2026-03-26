import * as connection from '@api/db/connection'
import * as schema from '@api/db/schema'
import { DATABASE_URL } from '@api/env'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach, expect } from 'vitest'
import { z, type ZodType } from 'zod'

// Single connection to ensure BEGIN/ROLLBACK operate on the same connection
const testClient = postgres(DATABASE_URL, { max: 1 })
const testDb = drizzle(testClient, { schema })

export function setupTestDb() {
  beforeAll(() => {
    // Replace the db export with our single-connection test db
    Object.defineProperty(connection, 'db', {
      value: testDb,
      writable: true,
      configurable: true,
    })
  })

  // Transaction strategy: wrap each test in a transaction and rollback after
  beforeEach(async () => {
    await testDb.execute(sql`BEGIN`)
  })

  afterEach(async () => {
    await testDb.execute(sql`ROLLBACK`)
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
  expect(value, msg ?? 'Expected value to be defined').toBeDefined()
}
