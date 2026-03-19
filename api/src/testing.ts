import * as schema from '@api/db/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, afterEach, beforeAll } from 'vitest'

const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://tq:tq@localhost:5432/tq_test'

const migrationClient = postgres(TEST_DATABASE_URL, { max: 1 })
const migrationDb = drizzle(migrationClient)

const queryClient = postgres(TEST_DATABASE_URL)
export const testDb = drizzle(queryClient, { schema })

export function setupTestDb() {
  beforeAll(async () => {
    await migrate(migrationDb, {
      migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
    })
  })

  afterEach(async () => {
    const res = await testDb.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'drizzle_%'`,
    )
    const tables = (res as unknown as Array<{ tablename: string }>).map(
      (t) => `"${t.tablename}"`,
    )
    if (tables.length > 0) {
      await testDb.execute(
        sql.raw(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`),
      )
    }
  })

  afterAll(async () => {
    await queryClient.end()
    await migrationClient.end()
  })
}
