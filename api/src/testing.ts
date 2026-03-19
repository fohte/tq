import * as connection from '@api/db/connection'
import * as schema from '@api/db/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

const databaseUrl =
  process.env['DATABASE_URL'] ?? 'postgresql://tq:tq@localhost:5432/tq_test'

// Single connection to ensure BEGIN/ROLLBACK operate on the same connection
const testClient = postgres(databaseUrl, { max: 1 })
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
