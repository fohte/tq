// Replace the production db with the test db (single connection for transaction control)
// This works because connection.ts exports a mutable binding
import * as connection from '@api/db/connection'
import * as schema from '@api/db/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

// Single connection to ensure BEGIN/SAVEPOINT/ROLLBACK operate on the same connection
const databaseUrl =
  process.env['DATABASE_URL'] ?? 'postgresql://tq:tq@localhost:5432/tq_test'
const testClient = postgres(databaseUrl, { max: 1 })
const testDb = drizzle(testClient, { schema })

export function setupTestDb() {
  beforeAll(async () => {
    await migrate(testDb, {
      migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
    })
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
