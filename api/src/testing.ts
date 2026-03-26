import * as connection from '@api/db/connection'
import * as schema from '@api/db/schema'
import { DATABASE_URL } from '@api/env'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach, expect } from 'vitest'

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
 * Parse a JSON response body as a typed value.
 * Centralizes the unavoidable `unknown -> T` cast for API test responses,
 * since `Response.json()` returns `unknown` and runtime validation (e.g. Zod)
 * is impractical in integration tests.
 */
export async function jsonBody<T>(res: Response): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return (await res.json()) as T
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
